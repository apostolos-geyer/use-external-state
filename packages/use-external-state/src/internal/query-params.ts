export type SerializedRecord = Record<
  string,
  string | (string | null)[] | null | undefined
>;

export function normalizeValue(value: unknown): SerializedRecord {
  const record: SerializedRecord = {};
  if (!value || typeof value !== 'object') {
    return record;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (entry === undefined) {
      return;
    }
    if (entry === null) {
      record[key] = null;
      return;
    }
    if (Array.isArray(entry)) {
      record[key] = entry.map((item) => (item === null ? null : String(item))) as (
        | string
        | null
      )[];
      return;
    }
    record[key] = String(entry);
  });

  return record;
}

export function defaultParse(params: URLSearchParams): SerializedRecord | undefined {
  const result: SerializedRecord = {};
  params.forEach((_value, key) => {
    const values = params.getAll(key);
    if (values.length === 0) {
      return;
    }
    if (values.length === 1) {
      result[key] = values[0] === 'null' ? null : values[0];
      return;
    }
    result[key] = values.map((item) => (item === 'null' ? null : item));
  });
  return Object.keys(result).length > 0 ? result : undefined;
}
