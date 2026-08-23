export function friendlyApiError(message: string) {
  try {
    const parsed = JSON.parse(message) as Array<{ message?: string }>
    const messages = parsed.map((item) => item.message).filter((item): item is string => Boolean(item))
    if (messages.length > 0) return [...new Set(messages)].join('. ')
  } catch {
    // Business errors from the API are already human-readable strings.
  }
  return message || 'Не получилось выполнить действие. Проверьте данные и попробуйте ещё раз.'
}
