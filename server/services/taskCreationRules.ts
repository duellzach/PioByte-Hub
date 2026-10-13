export class TaskCreationError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "TaskCreationError";
  }
}

export function taskProjectId(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !/^\d+$/.test(value))) {
    throw new TaskCreationError("Choose a valid board before creating a task", 400);
  }
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new TaskCreationError("Choose a valid board before creating a task", 400);
  return id;
}
