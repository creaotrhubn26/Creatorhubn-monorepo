// ProfileStore.swift
// Én autoritativ profiltilstand for header, kart og profilarket.

import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class ProfileStore {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    private(set) var profile: MyProfile?
    private(set) var loadState: LoadState = .idle
    private(set) var isSaving = false
    private(set) var isUploadingImage = false
    private(set) var lastError: String?

    @ObservationIgnored private var api: APIClient?
    #if DEBUG
    @ObservationIgnored private var isQAMode = false
    #endif

    func attach(api: APIClient) {
        self.api = api
    }

    func load(force: Bool = false) async {
        if !force, case .loaded = loadState { return }
        guard let api else {
            loadState = .failed("Du må være innlogget for å hente profilen.")
            return
        }

        loadState = .loading
        lastError = nil
        do {
            profile = try await api.fetchMyProfile().profile
            loadState = .loaded
        } catch {
            let message = error.localizedDescription
            lastError = message
            loadState = .failed(message)
        }
    }

    @discardableResult
    func save(_ draft: ProfileDraft) async throws -> MyProfile {
        let clientErrors = draft.validationErrors
        guard clientErrors.isEmpty else {
            throw ProfileStoreError.validation(clientErrors)
        }

        isSaving = true
        lastError = nil
        defer { isSaving = false }

        #if DEBUG
        if isQAMode, let current = profile {
            let value = draft.normalized
            let updated = Self.updatedProfile(current, draft: value)
            profile = updated
            loadState = .loaded
            return updated
        }
        #endif

        guard let api else { throw ProfileStoreError.notAuthenticated }
        do {
            let updated = try await api.patchMyProfile(draft.updateRequest).profile
            profile = updated
            loadState = .loaded
            return updated
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    @discardableResult
    func uploadImage(_ data: Data) async throws -> MyProfile {
        guard let api else { throw ProfileStoreError.notAuthenticated }
        isUploadingImage = true
        lastError = nil
        defer { isUploadingImage = false }
        do {
            let updated = try await api.uploadMyProfileImage(jpegData: data).profile
            profile = updated
            loadState = .loaded
            return updated
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    @discardableResult
    func removeImage() async throws -> MyProfile {
        guard let api else { throw ProfileStoreError.notAuthenticated }
        isUploadingImage = true
        lastError = nil
        defer { isUploadingImage = false }
        do {
            let updated = try await api.deleteMyProfileImage().profile
            profile = updated
            loadState = .loaded
            return updated
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    func reset() {
        api = nil
        profile = nil
        loadState = .idle
        isSaving = false
        isUploadingImage = false
        lastError = nil
        #if DEBUG
        isQAMode = false
        #endif
    }

    #if DEBUG
    func seedForQA(email: String) {
        isQAMode = true
        profile = MyProfile(
            userId: "qa-profile-user",
            firstName: "Ada",
            lastName: "Nordmann",
            email: email,
            phone: "+47 900 00 000",
            profession: "Salgskonsulent",
            profileImageUrl: nil,
            profileComplete: false,
            profileCompletedCount: 3,
            profileTotalRequired: 4
        )
        loadState = .loaded
    }
    #endif

    private static func updatedProfile(_ current: MyProfile, draft: ProfileDraft) -> MyProfile {
        let phone = draft.phone.isEmpty ? nil : draft.phone
        let profession = draft.profession.isEmpty ? nil : draft.profession
        let required = [
            current.profileImageUrl?.isEmpty == false,
            current.email?.isEmpty == false,
            phone?.isEmpty == false,
            profession?.isEmpty == false,
        ]
        let completed = required.filter { $0 }.count
        return MyProfile(
            userId: current.userId,
            firstName: draft.firstName.isEmpty ? nil : draft.firstName,
            lastName: draft.lastName.isEmpty ? nil : draft.lastName,
            email: current.email,
            phone: phone,
            profession: profession,
            profileImageUrl: current.profileImageUrl,
            profileComplete: completed == required.count,
            profileCompletedCount: completed,
            profileTotalRequired: required.count
        )
    }
}

enum ProfileStoreError: Error, LocalizedError {
    case notAuthenticated
    case validation([ProfileField: String])

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Du må være innlogget for å endre profilen."
        case .validation(let errors):
            return errors[.form] ?? errors.values.first ?? "Kontroller feltene og prøv igjen."
        }
    }
}

@MainActor
enum ProfileImageProcessor {
    static let maximumUploadBytes = 3_800_000
    static let maximumDimension: CGFloat = 1_600

    static func jpegData(from sourceData: Data) throws -> Data {
        guard let source = UIImage(data: sourceData) else {
            throw ProfileImageError.unreadable
        }

        let longestSide = max(source.size.width, source.size.height)
        let scale = longestSide > maximumDimension ? maximumDimension / longestSide : 1
        let targetSize = CGSize(
            width: max(1, floor(source.size.width * scale)),
            height: max(1, floor(source.size.height * scale))
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let normalized = UIGraphicsImageRenderer(size: targetSize, format: format).image { _ in
            UIColor.black.setFill()
            UIRectFill(CGRect(origin: .zero, size: targetSize))
            source.draw(in: CGRect(origin: .zero, size: targetSize))
        }

        for quality in [0.88, 0.76, 0.64, 0.52, 0.40] {
            if let data = normalized.jpegData(compressionQuality: quality),
               data.count <= maximumUploadBytes {
                return data
            }
        }
        throw ProfileImageError.tooLarge
    }
}

enum ProfileImageError: Error, LocalizedError {
    case unreadable
    case tooLarge

    var errorDescription: String? {
        switch self {
        case .unreadable:
            return "Kunne ikke lese bildet. Velg et annet bilde."
        case .tooLarge:
            return "Bildet er for stort etter komprimering. Velg et mindre bilde."
        }
    }
}
