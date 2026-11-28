"""Public reason codes only: never expose provider messages or credentials."""
REASONS = {'missing_key', 'keys_unavailable', 'invalid_key', 'unreadable_key', 'daily_limit',
           'provider_daily_limit', 'rate_limited', 'model_unavailable', 'provider_unavailable',
           'network_error', 'invalid_response', 'region_unsupported'}


def indexing_reason(status: str, error: str | None) -> str | None:
    if status not in {'queued', 'failed'}: return None
    if error in REASONS: return error
    if error == 'Text extraction provider is unavailable; awaiting retry': return 'provider_unavailable'
    return 'keys_unavailable' if status == 'queued' else 'extraction_failed'
