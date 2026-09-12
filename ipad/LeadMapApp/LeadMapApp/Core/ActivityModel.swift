// ActivityModel.swift

import Foundation

struct ActivityModel: Identifiable, Codable, Hashable {
    let id: String
    let customerName: String?
    let userName: String?
    let activityType: String
    let description: String?
    let createdAt: Date
}
