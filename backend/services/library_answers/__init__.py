"""Retrieval-grounded Library answers, separate from review and legacy chat."""


class AnswerError(RuntimeError):
    def __init__(self, code, message, status=409):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status
