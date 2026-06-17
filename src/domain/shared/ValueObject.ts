/**
 * Base class for value objects.
 *
 * Value objects have no identity — two value objects are equal when their
 * contents are equal. Subclasses simply declare their fields; `equals` compares
 * by structural value (and by concrete type, so a `Score` never equals a
 * `TaskExecutionResult` even with identical fields).
 */
export abstract class ValueObject {
  equals(other?: ValueObject | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this.constructor !== other.constructor) {
      return false;
    }
    return JSON.stringify(this) === JSON.stringify(other);
  }
}
