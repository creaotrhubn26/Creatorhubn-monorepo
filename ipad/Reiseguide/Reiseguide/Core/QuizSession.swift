// QuizSession.swift
//
// Tilstand for den korte quizen etter besøket: ett spørsmål om gangen,
// svaret låses når man har valgt, så vises fasit og forklaring før neste.
// Ren verditype uten UI, så den kan enhetstestes.

import Foundation

struct QuizSession: Equatable, Sendable {
    let questions: [QuizQuestion]
    private(set) var index = 0
    /// Valgt alternativ per spørsmål; nil til det er besvart.
    private(set) var answers: [Int?]

    init(questions: [QuizQuestion]) {
        self.questions = questions
        answers = Array(repeating: nil, count: questions.count)
    }

    var total: Int { questions.count }
    var isEmpty: Bool { questions.isEmpty }
    var isFinished: Bool { index >= questions.count }
    var current: QuizQuestion? { questions.indices.contains(index) ? questions[index] : nil }
    var currentAnswer: Int? { answers.indices.contains(index) ? answers[index] : nil }
    var hasAnsweredCurrent: Bool { currentAnswer != nil }
    var isLastQuestion: Bool { index == questions.count - 1 }

    var correctCount: Int {
        zip(questions, answers).reduce(0) { sum, pair in
            sum + (pair.1 == pair.0.correctIndex ? 1 : 0)
        }
    }

    func isCorrect(option: Int) -> Bool { current?.correctIndex == option }

    /// Låser svaret på gjeldende spørsmål; andre trykk ignoreres.
    mutating func answer(_ option: Int) {
        guard let current, current.options.indices.contains(option), currentAnswer == nil else { return }
        answers[index] = option
    }

    mutating func next() {
        guard hasAnsweredCurrent else { return }
        index += 1
    }

    mutating func restart() {
        index = 0
        answers = Array(repeating: nil, count: questions.count)
    }
}
