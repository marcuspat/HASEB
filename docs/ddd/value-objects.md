# Value Objects

A **value object** is identified by its attributes; equality is structural.
Value objects are immutable. Constructing one with invalid data throws a
typed error — there is no such thing as an "invalid" value object instance.

## Shared Building Blocks

### `Money`
```ts
type Money = {
  readonly amount: number;     // non-negative; up to 6 decimal places
  readonly currency: 'USD';    // expandable later via union extension
};
```
Invariants: `amount >= 0`, finite, not NaN.

### `Duration`
```ts
type Duration = {
  readonly milliseconds: number;  // non-negative integer
};
```
Invariants: `milliseconds >= 0`, integer.

### `TokenCount`
```ts
type TokenCount = {
  readonly input: number;
  readonly output: number;
};
```
Invariants: both non-negative integers.

### `Percentage`
```ts
type Percentage = {
  readonly value: number; // [0.0, 1.0]
};
```

### `EvaluationState`
```ts
type EvaluationState =
  | 'queued'
  | 'running'
  | 'collecting'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'cancelled';
```
The state machine is documented in
[contexts/evaluation-context.md](./contexts/evaluation-context.md).

### `RunOutcome`
```ts
type RunOutcome =
  | { kind: 'success' }
  | { kind: 'failure'; reason: string }
  | { kind: 'cancelled'; reason: string };
```

### `StepKind` and `StepStatus`
```ts
type StepKind = 'tool_call' | 'llm_call' | 'screen_action' | 'other';
type StepStatus = 'ok' | 'error';
```

### `AgentProfile`
```ts
type AgentProfile = {
  readonly provider: string;     // e.g. 'anthropic'
  readonly model: string;        // e.g. 'claude-opus-4-7'
  readonly systemPrompt: string;
  readonly tools: readonly string[];
  readonly parameters: Readonly<Record<string, JsonValue>>;
};
```

### `OracleSpec`
```ts
type OracleSpec = {
  readonly kind: 'unit_test' | 'rubric' | 'reference_match' | 'custom';
  readonly definition: JsonValue;  // schema depends on kind
};
```

### `Role`
```ts
type Role = 'admin' | 'analyst' | 'submitter' | 'viewer';
```

## Metric Dimensions

The five Metric Dimensions are themselves value objects, each carrying a
typed payload. They are immutable once attached to a `MetricSet`.

### `PerformanceMetric`
```ts
type PerformanceMetric = {
  readonly dimension: 'performance';
  readonly taskSuccessRate: Percentage;
  readonly partialCredit: Percentage;
  readonly tasksAttempted: number;
  readonly tasksPassed: number;
};
```

### `EfficiencyMetric`
```ts
type EfficiencyMetric = {
  readonly dimension: 'efficiency';
  readonly executionTime: Duration;
  readonly latencyPerStep: Duration;
  readonly totalSteps: number;
};
```

### `CostMetric`
```ts
type CostMetric = {
  readonly dimension: 'cost';
  readonly tokens: TokenCount;
  readonly estimatedCost: Money;
};
```

### `RobustnessMetric`
```ts
type RobustnessMetric = {
  readonly dimension: 'robustness';
  readonly toolCallErrorRate: Percentage;
  readonly recoveryRate: Percentage;
  readonly retries: number;
};
```

### `QualityMetric`
```ts
type QualityMetric = {
  readonly dimension: 'quality';
  readonly toolSelectionAccuracy: Percentage;
  readonly parameterAccuracy: Percentage;
};
```

### `MetricDimension` (sum type)
```ts
type MetricDimension =
  | PerformanceMetric
  | EfficiencyMetric
  | CostMetric
  | RobustnessMetric
  | QualityMetric;
```

## Composite Score

### `ProcessViabilityScore`
```ts
type ProcessViabilityScore = {
  readonly value: Percentage;        // [0.0, 1.0]
  readonly weights: {
    readonly performance: number;    // sum of weights = 1.0
    readonly efficiency:  number;
    readonly cost:        number;
    readonly robustness:  number;
    readonly quality:     number;
  };
  readonly version: string;          // weighting scheme version
};
```

The Process Viability Score is computed by `ProcessViabilityCalculator`
(domain service). The weighting scheme is versioned so that comparing scores
across versions is explicit.

## Identifiers and Tokens

### `JwtAccessToken` / `JwtRefreshToken`
Opaque to the domain; produced and verified by the Identity & Access context.

### `Fingerprint`
```ts
type Fingerprint = {
  readonly algorithm: 'sha256';
  readonly value: string; // hex
};
```

## Equality and Construction

- Equality is structural: two value objects are equal if all their fields
  are equal.
- Construction goes through factory functions (`createMoney`,
  `createPercentage`) that enforce invariants.
- Mutation produces a new value object: `withAmount`, `add`, `multiply` —
  never in place.

## Persistence

Value objects are stored either as columns (when the shape is fixed and
small) or as JSON inside a JSONB column (when the shape is variant — e.g.
`MetricDimension`). Repository data mappers handle the round trip.
