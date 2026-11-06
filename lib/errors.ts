/** An expected failure with a message safe to show to the person using the app. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
