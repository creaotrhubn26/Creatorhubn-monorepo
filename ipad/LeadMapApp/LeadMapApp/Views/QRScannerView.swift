// QRScannerView.swift
//
// AVCaptureSession-basert QR-scanner for pairing. Erstatter ScannerStub.
// Skanner ROLE-ROOM-PAIR:<token> formaterte koder fra web Admin Room.

import SwiftUI
import AVFoundation

struct QRScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void
    let onError: (Error) -> Void

    func makeUIViewController(context: Context) -> ScannerViewController {
        let vc = ScannerViewController()
        vc.onScan = { code in
            DispatchQueue.main.async { onScan(code) }
        }
        vc.onError = { err in
            DispatchQueue.main.async { onError(err) }
        }
        return vc
    }

    func updateUIViewController(_ uiViewController: ScannerViewController, context: Context) {}
}

final class ScannerViewController: UIViewController {
    var onScan: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let metadataOutput = AVCaptureMetadataOutput()
    private let delegate = ScannerDelegate()
    private var hasDelivered = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        delegate.parent = self
        configureSession()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if !session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.startRunning()
            }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning {
            session.stopRunning()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    private func configureSession() {
        guard let device = AVCaptureDevice.default(for: .video) else {
            onError?(QRError.cameraUnavailable)
            return
        }
        do {
            let input = try AVCaptureDeviceInput(device: device)
            if session.canAddInput(input) {
                session.addInput(input)
            } else {
                onError?(QRError.cannotAddInput)
                return
            }
            if session.canAddOutput(metadataOutput) {
                session.addOutput(metadataOutput)
                metadataOutput.setMetadataObjectsDelegate(delegate, queue: .main)
                metadataOutput.metadataObjectTypes = [.qr]
            } else {
                onError?(QRError.cannotAddOutput)
                return
            }

            let preview = AVCaptureVideoPreviewLayer(session: session)
            preview.videoGravity = .resizeAspectFill
            preview.frame = view.bounds
            view.layer.insertSublayer(preview, at: 0)
            self.previewLayer = preview
        } catch {
            onError?(error)
        }
    }

    func deliver(_ code: String) {
        guard !hasDelivered else { return }
        hasDelivered = true
        onScan?(code)
    }
}

private final class ScannerDelegate: NSObject, AVCaptureMetadataOutputObjectsDelegate {
    weak var parent: ScannerViewController?

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                       didOutput metadataObjects: [AVMetadataObject],
                       from connection: AVCaptureConnection) {
        guard
            let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
            obj.type == .qr,
            let value = obj.stringValue
        else { return }
        parent?.deliver(value)
    }
}

enum QRError: Error, LocalizedError {
    case cameraUnavailable
    case cannotAddInput
    case cannotAddOutput

    var errorDescription: String? {
        switch self {
        case .cameraUnavailable: return "Kamera er ikke tilgjengelig."
        case .cannotAddInput: return "Kunne ikke åpne kamera-input."
        case .cannotAddOutput: return "Kunne ikke konfigurere skanner-output."
        }
    }
}
