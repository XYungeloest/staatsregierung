#!/usr/bin/env swift

import Foundation
import PDFKit

struct PageText: Codable {
  let page: Int
  let text: String
}

guard CommandLine.arguments.count == 2 else {
  FileHandle.standardError.write(Data("Aufruf: extract-pdf-text.swift DATEI.pdf\n".utf8))
  exit(2)
}

let source = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: source) else {
  FileHandle.standardError.write(Data("PDF konnte nicht geöffnet werden: \(source.path)\n".utf8))
  exit(1)
}

let pages = (0..<document.pageCount).map { index in
  PageText(page: index + 1, text: document.page(at: index)?.string ?? "")
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try encoder.encode(pages))
FileHandle.standardOutput.write(Data("\n".utf8))
