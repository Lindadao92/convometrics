"""HTTP transport layer. Isolated for easy mocking in tests."""

import urllib.request
import urllib.error


class Response:
    """Minimal response wrapper around urllib."""

    def __init__(self, status_code, text):
        self.status_code = status_code
        self.text = text


def post(url, data, headers, timeout):
    """Send a POST request using urllib (no external dependencies).

    Args:
        url: Target URL.
        data: Request body as a string.
        headers: Dict of HTTP headers.
        timeout: Timeout in seconds.

    Returns:
        Response object with status_code and text.
    """
    req = urllib.request.Request(
        url,
        data=data.encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return Response(resp.status, resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return Response(e.code, e.read().decode("utf-8"))
    except urllib.error.URLError as e:
        raise ConnectionError(f"Failed to connect to {url}: {e.reason}") from e
