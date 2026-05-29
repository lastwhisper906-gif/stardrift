export interface IEvent {
  readonly id: string
  onEnter(): void
  update(dt: number): void
  onExit(): void
  isComplete(): boolean
}
