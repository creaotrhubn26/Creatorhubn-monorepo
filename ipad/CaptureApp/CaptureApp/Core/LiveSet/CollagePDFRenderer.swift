import Foundation
import SwiftUI
import UIKit

/// Renders a collage of captured tiles to a multi-page A4-landscape
/// PDF that can be AirDropped / emailed to a client. Uses
/// ``URLSession`` to fetch the actual image bytes (the in-app
/// AsyncImage cache lives in the view layer and isn't reachable from
/// here), then ``UIGraphicsPDFRenderer`` to lay them out.
///
/// Layout: 4 columns × 3 rows per page = 12 tiles per page. Each cell
/// gets its scene title underneath. Footer carries the date + filter
/// label so the client knows what they're looking at.
enum CollagePDFRenderer {
    /// PDF page size — A4 landscape at 72 dpi.
    private static let pageSize = CGSize(width: 842, height: 595)
    private static let cellPadding: CGFloat = 8
    private static let outerPadding: CGFloat = 24
    private static let columnsPerPage = 4
    private static let rowsPerPage = 3

    /// Render the supplied tiles + write to a temp file. Returns nil if
    /// the page renderer fails (e.g. zero tiles after filtering, or
    /// disk-write error).
    static func render(
        tiles: [CoverageTile],
        filterLabel: String,
    ) async -> URL? {
        guard !tiles.isEmpty else { return nil }

        // Pre-fetch all thumbnail bytes in parallel so the actual draw
        // step doesn't block on network — keeps the export experience
        // a single spinner instead of "first tile in 200ms, last in 30s".
        let images = await withTaskGroup(of: (Int, UIImage?).self) { group in
            for (i, tile) in tiles.enumerated() {
                group.addTask { (i, await fetchImage(for: tile)) }
            }
            var collected = Array<UIImage?>(repeating: nil, count: tiles.count)
            for await (i, img) in group { collected[i] = img }
            return collected
        }

        let renderer = UIGraphicsPDFRenderer(
            bounds: CGRect(origin: .zero, size: pageSize),
        )

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(
                "creatorhubone-collage-\(Int(Date().timeIntervalSince1970)).pdf",
            )

        do {
            try renderer.writePDF(to: url) { context in
                let perPage = columnsPerPage * rowsPerPage
                let pageCount = Int((Double(tiles.count) / Double(perPage)).rounded(.up))
                for pageIdx in 0..<pageCount {
                    context.beginPage()
                    drawHeader(filterLabel: filterLabel, pageIdx: pageIdx, pageCount: pageCount)
                    let start = pageIdx * perPage
                    let end = min(start + perPage, tiles.count)
                    for (slot, i) in (start..<end).enumerated() {
                        drawCell(
                            slot: slot,
                            tile: tiles[i],
                            image: images[i],
                        )
                    }
                }
            }
            return url
        } catch {
            return nil
        }
    }

    // MARK: - Drawing

    private static func drawHeader(filterLabel: String, pageIdx: Int, pageCount: Int) {
        let headerHeight: CGFloat = 28
        let headerRect = CGRect(
            x: outerPadding,
            y: outerPadding / 2,
            width: pageSize.width - outerPadding * 2,
            height: headerHeight,
        )
        let title = NSAttributedString(
            string: "CreatorHub One — \(filterLabel)",
            attributes: [
                .font: UIFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: UIColor.label,
            ],
        )
        title.draw(at: CGPoint(x: headerRect.minX, y: headerRect.minY))

        let date = ISO8601DateFormatter().string(from: Date()).prefix(10)
        let footer = NSAttributedString(
            string: "\(date) · side \(pageIdx + 1) av \(pageCount)",
            attributes: [
                .font: UIFont.systemFont(ofSize: 10, weight: .regular),
                .foregroundColor: UIColor.secondaryLabel,
            ],
        )
        let footerSize = footer.size()
        footer.draw(at: CGPoint(
            x: pageSize.width - outerPadding - footerSize.width,
            y: headerRect.minY + 2,
        ))
    }

    private static func drawCell(slot: Int, tile: CoverageTile, image: UIImage?) {
        let row = slot / columnsPerPage
        let col = slot % columnsPerPage
        let gridArea = CGRect(
            x: outerPadding,
            y: outerPadding + 28, // below header
            width: pageSize.width - outerPadding * 2,
            height: pageSize.height - outerPadding - 28 - outerPadding,
        )
        let cellWidth = (gridArea.width - cellPadding * CGFloat(columnsPerPage - 1)) / CGFloat(columnsPerPage)
        let cellHeight = (gridArea.height - cellPadding * CGFloat(rowsPerPage - 1)) / CGFloat(rowsPerPage)
        let cellRect = CGRect(
            x: gridArea.minX + CGFloat(col) * (cellWidth + cellPadding),
            y: gridArea.minY + CGFloat(row) * (cellHeight + cellPadding),
            width: cellWidth,
            height: cellHeight,
        )

        // Image area — leave 18pt strip at bottom for the scene caption.
        let captionStripHeight: CGFloat = 18
        let imageArea = CGRect(
            x: cellRect.minX,
            y: cellRect.minY,
            width: cellRect.width,
            height: cellRect.height - captionStripHeight,
        )

        // Draw a black background so missing images don't leave white voids.
        UIColor.black.setFill()
        UIRectFill(imageArea)

        if let image {
            let drawn = aspectFit(image: image, in: imageArea)
            image.draw(in: drawn)
        } else {
            let label = NSAttributedString(
                string: "(thumbnail uavailable)",
                attributes: [
                    .font: UIFont.systemFont(ofSize: 9),
                    .foregroundColor: UIColor.lightGray,
                ],
            )
            let size = label.size()
            label.draw(at: CGPoint(
                x: imageArea.midX - size.width / 2,
                y: imageArea.midY - size.height / 2,
            ))
        }

        // Caption strip
        let captionRect = CGRect(
            x: cellRect.minX,
            y: cellRect.maxY - captionStripHeight,
            width: cellRect.width,
            height: captionStripHeight,
        )
        let caption = NSAttributedString(
            string: tile.scene,
            attributes: [
                .font: UIFont.systemFont(ofSize: 9, weight: .medium),
                .foregroundColor: UIColor.label,
            ],
        )
        caption.draw(in: captionRect.insetBy(dx: 2, dy: 2))
    }

    private static func aspectFit(image: UIImage, in rect: CGRect) -> CGRect {
        let imageAR = image.size.width / image.size.height
        let rectAR = rect.width / rect.height
        if imageAR > rectAR {
            // Image is wider — fit width, letterbox top + bottom.
            let h = rect.width / imageAR
            return CGRect(
                x: rect.minX,
                y: rect.minY + (rect.height - h) / 2,
                width: rect.width,
                height: h,
            )
        } else {
            let w = rect.height * imageAR
            return CGRect(
                x: rect.minX + (rect.width - w) / 2,
                y: rect.minY,
                width: w,
                height: rect.height,
            )
        }
    }

    // MARK: - Image fetch

    private static func fetchImage(for tile: CoverageTile) async -> UIImage? {
        guard case .captured(let urlString, _, _, _) = tile.state,
              let urlString,
              let url = URL(string: urlString)
        else { return nil }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return UIImage(data: data)
        } catch {
            return nil
        }
    }
}
