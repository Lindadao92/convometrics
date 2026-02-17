"""
Seed 500 realistic demo conversations into Supabase.

Usage:
    python -m scripts.seed_demo_data

Requires SUPABASE_URL, SUPABASE_KEY in .env, plus a customer row with a known id.
"""

import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

NUM_CONVERSATIONS = 500
NUM_USERS = 50

INTENTS = [
    "code_generation > write_function",
    "code_generation > write_class",
    "code_generation > write_test",
    "code_generation > generate_boilerplate",
    "debugging > fix_error",
    "debugging > troubleshoot",
    "debugging > review_code",
    "understanding > explain_code",
    "understanding > explain_concept",
    "understanding > summarize",
    "refactoring > improve_performance",
    "refactoring > restructure",
    "refactoring > simplify",
    "configuration > setup_environment",
    "configuration > install_dependency",
    "configuration > configure_tool",
    "data > query_data",
    "data > transform_data",
    "documentation > write_docs",
    "planning > design_architecture",
    "general > other",
]

COMPLETION_WEIGHTS = {
    "completed": 55,
    "partial": 20,
    "abandoned": 15,
    "failed": 10,
}

CONVERSATIONS_BY_INTENT = {
    "code_generation > write_function": [
        [
            {"role": "user", "content": "Write a Python function that checks if a string is a valid email address using regex."},
            {"role": "assistant", "content": "Here's a function using the `re` module:\n\n```python\nimport re\n\ndef is_valid_email(email: str) -> bool:\n    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'\n    return bool(re.match(pattern, email))\n```\n\nThis covers most standard email formats."},
            {"role": "user", "content": "Can you add support for plus addressing like user+tag@example.com?"},
            {"role": "assistant", "content": "The function already supports plus addressing — the `+` is included in the `[a-zA-Z0-9._%+-]` character class. So `user+tag@example.com` will return `True`."},
        ],
        [
            {"role": "user", "content": "I need a function that takes a list of numbers and returns the top N largest values."},
            {"role": "assistant", "content": "```python\ndef top_n(numbers: list[int | float], n: int) -> list[int | float]:\n    return sorted(numbers, reverse=True)[:n]\n```\n\nFor better performance on large lists, use `heapq.nlargest(n, numbers)` which is O(n log k) instead of O(n log n)."},
        ],
        [
            {"role": "user", "content": "Write a TypeScript function that debounces another function."},
            {"role": "assistant", "content": "```typescript\nfunction debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {\n  let timer: ReturnType<typeof setTimeout>;\n  return ((...args: Parameters<T>) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  }) as T;\n}\n```\n\nUsage: `const debouncedSearch = debounce(search, 300);`"},
            {"role": "user", "content": "How do I add a cancel method to it?"},
            {"role": "assistant", "content": "Return an object with both `call` and `cancel`:\n\n```typescript\nfunction debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {\n  let timer: ReturnType<typeof setTimeout>;\n  return {\n    call: (...args: Parameters<T>) => {\n      clearTimeout(timer);\n      timer = setTimeout(() => fn(...args), delay);\n    },\n    cancel: () => clearTimeout(timer),\n  };\n}\n```"},
        ],
    ],
    "code_generation > write_class": [
        [
            {"role": "user", "content": "Create a Python class for a simple LRU cache with get and put methods."},
            {"role": "assistant", "content": "```python\nfrom collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        self.cache = OrderedDict()\n        self.capacity = capacity\n\n    def get(self, key):\n        if key not in self.cache:\n            return -1\n        self.cache.move_to_end(key)\n        return self.cache[key]\n\n    def put(self, key, value):\n        if key in self.cache:\n            self.cache.move_to_end(key)\n        self.cache[key] = value\n        if len(self.cache) > self.capacity:\n            self.cache.popitem(last=False)\n```"},
            {"role": "user", "content": "Perfect, thanks!"},
        ],
    ],
    "code_generation > write_test": [
        [
            {"role": "user", "content": "Write pytest tests for a function `calculate_discount(price, percentage)` that returns the discounted price."},
            {"role": "assistant", "content": "```python\nimport pytest\nfrom myapp import calculate_discount\n\ndef test_basic_discount():\n    assert calculate_discount(100, 10) == 90.0\n\ndef test_zero_discount():\n    assert calculate_discount(100, 0) == 100.0\n\ndef test_full_discount():\n    assert calculate_discount(100, 100) == 0.0\n\ndef test_negative_price():\n    with pytest.raises(ValueError):\n        calculate_discount(-50, 10)\n\ndef test_percentage_over_100():\n    with pytest.raises(ValueError):\n        calculate_discount(100, 150)\n\ndef test_float_precision():\n    assert calculate_discount(33.33, 15) == pytest.approx(28.33, abs=0.01)\n```"},
        ],
    ],
    "code_generation > generate_boilerplate": [
        [
            {"role": "user", "content": "Generate a basic Express.js API boilerplate with error handling middleware."},
            {"role": "assistant", "content": "```javascript\nconst express = require('express');\nconst app = express();\n\napp.use(express.json());\n\napp.get('/health', (req, res) => res.json({ status: 'ok' }));\n\n// Error handling middleware\napp.use((err, req, res, next) => {\n  console.error(err.stack);\n  res.status(err.status || 500).json({\n    error: err.message || 'Internal Server Error',\n  });\n});\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(`Server running on port ${PORT}`));\n```"},
            {"role": "user", "content": "Add CORS and rate limiting."},
            {"role": "assistant", "content": "Add these packages and middleware:\n\n```javascript\nconst cors = require('cors');\nconst rateLimit = require('express-rate-limit');\n\napp.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));\napp.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));\n```\n\nInstall with: `npm install cors express-rate-limit`"},
        ],
    ],
    "debugging > fix_error": [
        [
            {"role": "user", "content": "I'm getting 'TypeError: Cannot read properties of undefined (reading map)' in my React component. Here's the code:\n\n```jsx\nfunction UserList({ users }) {\n  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>\n}\n```"},
            {"role": "assistant", "content": "The error occurs when `users` is `undefined` on initial render (e.g., before your API call resolves). Add a default value:\n\n```jsx\nfunction UserList({ users = [] }) {\n  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>\n}\n```\n\nOr use optional chaining: `users?.map(...)`. The default parameter approach is cleaner since it also handles the empty state."},
            {"role": "user", "content": "That fixed it, thanks!"},
        ],
        [
            {"role": "user", "content": "Getting a segfault in my C program when I try to free a pointer twice."},
            {"role": "assistant", "content": "Double-free is undefined behavior. After freeing, set the pointer to NULL:\n\n```c\nfree(ptr);\nptr = NULL;\n```\n\n`free(NULL)` is safe and does nothing, so subsequent frees won't crash. Also consider using tools like AddressSanitizer (`-fsanitize=address`) to catch these at development time."},
        ],
        [
            {"role": "user", "content": "My Python script throws 'RecursionError: maximum recursion depth exceeded'. The function works for small inputs but fails on larger ones."},
            {"role": "assistant", "content": "You likely have a recursive function without a proper base case, or the input is too deep for Python's default recursion limit (1000). Options:\n\n1. **Fix the base case** — make sure recursion terminates\n2. **Convert to iteration** using an explicit stack\n3. **Increase the limit** (not recommended): `sys.setrecursionlimit(10000)`\n\nCan you share the function? Converting to iteration is usually the best fix."},
            {"role": "user", "content": "It's a tree traversal. I'll convert to iteration."},
            {"role": "assistant", "content": "Good call. Here's the pattern:\n\n```python\ndef traverse(root):\n    stack = [root]\n    while stack:\n        node = stack.pop()\n        process(node)\n        stack.extend(node.children)\n```"},
        ],
    ],
    "debugging > troubleshoot": [
        [
            {"role": "user", "content": "My Docker container keeps restarting. How do I debug this?"},
            {"role": "assistant", "content": "Check these in order:\n\n1. `docker logs <container>` — see the crash output\n2. `docker inspect <container> --format='{{.State.ExitCode}}'` — exit code hints at the cause\n3. `docker events` — watch real-time container events\n\nCommon causes: OOM kills (exit code 137), missing env vars, port conflicts, or the entrypoint script failing."},
            {"role": "user", "content": "Exit code is 137, so it's OOM?"},
            {"role": "assistant", "content": "Yes, 137 = SIGKILL, almost always OOM. Increase the memory limit:\n\n```bash\ndocker run -m 512m your-image\n```\n\nOr in docker-compose:\n```yaml\nservices:\n  app:\n    mem_limit: 512m\n```\n\nAlso check if your app has a memory leak — monitor with `docker stats`."},
        ],
    ],
    "debugging > review_code": [
        [
            {"role": "user", "content": "Can you review this authentication middleware?\n\n```python\ndef auth_middleware(request):\n    token = request.headers.get('Authorization')\n    if token:\n        user = db.query('SELECT * FROM users WHERE token = ' + token)\n        request.user = user\n    return request\n```"},
            {"role": "assistant", "content": "Several issues:\n\n1. **SQL injection** — you're concatenating user input directly into the query. Use parameterized queries: `db.query('SELECT * FROM users WHERE token = %s', (token,))`\n2. **No Bearer prefix handling** — strip `Bearer ` from the header\n3. **No error handling** — if `token` is invalid, `request.user` is never set, which may cause downstream errors\n4. **No token validation** — you should verify the token hasn't expired\n\nHere's a safer version:\n\n```python\ndef auth_middleware(request):\n    header = request.headers.get('Authorization', '')\n    if not header.startswith('Bearer '):\n        request.user = None\n        return request\n    token = header[7:]\n    user = db.query('SELECT * FROM users WHERE token = %s AND expires_at > NOW()', (token,))\n    request.user = user\n    return request\n```"},
        ],
    ],
    "understanding > explain_code": [
        [
            {"role": "user", "content": "What does this Python decorator do?\n\n```python\ndef memoize(func):\n    cache = {}\n    def wrapper(*args):\n        if args not in cache:\n            cache[args] = func(*args)\n        return cache[args]\n    return wrapper\n```"},
            {"role": "assistant", "content": "This is a **memoization decorator**. It caches function results so repeated calls with the same arguments return instantly instead of recomputing.\n\nHow it works:\n1. `cache = {}` — a dict that maps argument tuples to return values\n2. When `wrapper(*args)` is called, it checks if `args` is already in `cache`\n3. If not cached, it calls the original `func(*args)`, stores the result, and returns it\n4. If cached, it skips the function call and returns the stored result\n\nUseful for expensive pure functions like recursive Fibonacci. Python's stdlib has `functools.lru_cache` which does the same with an eviction policy."},
        ],
        [
            {"role": "user", "content": "Explain what this SQL query does:\n\n```sql\nSELECT department, AVG(salary) as avg_salary\nFROM employees\nWHERE hire_date > '2023-01-01'\nGROUP BY department\nHAVING AVG(salary) > 75000\nORDER BY avg_salary DESC;\n```"},
            {"role": "assistant", "content": "This query finds departments where recently hired employees earn well above average:\n\n1. `FROM employees` — starts with all employee rows\n2. `WHERE hire_date > '2023-01-01'` — filters to only employees hired after Jan 1, 2023\n3. `GROUP BY department` — groups the remaining rows by department\n4. `AVG(salary)` — calculates the average salary within each department group\n5. `HAVING AVG(salary) > 75000` — keeps only departments where the average exceeds $75k\n6. `ORDER BY avg_salary DESC` — sorts results from highest to lowest average salary\n\nThe key distinction: `WHERE` filters individual rows before grouping, `HAVING` filters groups after aggregation."},
        ],
    ],
    "understanding > explain_concept": [
        [
            {"role": "user", "content": "What's the difference between concurrency and parallelism?"},
            {"role": "assistant", "content": "**Concurrency** = dealing with multiple things at once (structure). **Parallelism** = doing multiple things at once (execution).\n\n- **Concurrency**: A single barista alternating between taking orders and making coffee. Tasks overlap in time but may not run simultaneously. Python's `asyncio` is concurrent but single-threaded.\n\n- **Parallelism**: Two baristas each making a coffee simultaneously. Tasks literally execute at the same time on multiple cores. Python's `multiprocessing` achieves this.\n\nYou can have concurrency without parallelism (async I/O on one core) and parallelism without concurrency (SIMD operations). Most real systems use both."},
        ],
        [
            {"role": "user", "content": "Can you explain what a closure is in JavaScript?"},
            {"role": "assistant", "content": "A closure is a function that remembers the variables from its outer scope, even after the outer function has returned.\n\n```javascript\nfunction makeCounter() {\n  let count = 0;  // outer variable\n  return function() {\n    count++;  // inner function \"closes over\" count\n    return count;\n  };\n}\n\nconst counter = makeCounter();\ncounter(); // 1\ncounter(); // 2\ncounter(); // 3\n```\n\n`makeCounter()` has already returned, but the inner function still has access to `count`. Each call to `makeCounter()` creates a new, independent closure with its own `count`. Closures are how JavaScript implements data privacy and stateful functions."},
        ],
    ],
    "understanding > summarize": [
        [
            {"role": "user", "content": "Summarize the key differences between REST and GraphQL APIs."},
            {"role": "assistant", "content": "**REST**: Multiple endpoints (`/users`, `/posts`), fixed response shapes, uses HTTP verbs (GET/POST/PUT/DELETE). Simple and cacheable, but can over-fetch or under-fetch data requiring multiple round trips.\n\n**GraphQL**: Single endpoint, client specifies exactly what data it needs in a query. Solves over/under-fetching, great for complex nested data. But adds complexity, harder to cache, and can have performance issues with deeply nested queries.\n\n**Choose REST** for simple CRUD APIs with predictable access patterns. **Choose GraphQL** when clients need flexible queries across related data (dashboards, mobile apps with varying data needs)."},
        ],
    ],
    "refactoring > improve_performance": [
        [
            {"role": "user", "content": "This function is slow for large lists. How can I optimize it?\n\n```python\ndef find_duplicates(items):\n    duplicates = []\n    for i in range(len(items)):\n        for j in range(i + 1, len(items)):\n            if items[i] == items[j] and items[i] not in duplicates:\n                duplicates.append(items[i])\n    return duplicates\n```"},
            {"role": "assistant", "content": "Your current approach is O(n^3) — nested loops plus `in` check on a list. Here's an O(n) version using a set:\n\n```python\ndef find_duplicates(items):\n    seen = set()\n    duplicates = set()\n    for item in items:\n        if item in seen:\n            duplicates.add(item)\n        seen.add(item)\n    return list(duplicates)\n```\n\nOr even more concisely with Counter:\n```python\nfrom collections import Counter\ndef find_duplicates(items):\n    return [item for item, count in Counter(items).items() if count > 1]\n```"},
            {"role": "user", "content": "Wow, the set version is way faster. Thanks!"},
        ],
    ],
    "refactoring > restructure": [
        [
            {"role": "user", "content": "I have a 500-line God class that handles user auth, profile management, and email sending. How should I split it?"},
            {"role": "assistant", "content": "Apply the Single Responsibility Principle — split into three classes:\n\n1. **`AuthService`** — login, logout, token management, password reset\n2. **`ProfileService`** — CRUD for user profiles, preferences, avatars\n3. **`EmailService`** — sending emails, templates, queue management\n\nEach class gets its own file. They can depend on each other through dependency injection:\n\n```python\nclass AuthService:\n    def __init__(self, email_service: EmailService):\n        self.email = email_service\n\n    def reset_password(self, user_id):\n        token = self._generate_reset_token(user_id)\n        self.email.send_reset_email(user_id, token)\n```\n\nThis makes each piece independently testable and keeps changes isolated."},
        ],
    ],
    "refactoring > simplify": [
        [
            {"role": "user", "content": "Can you simplify this?\n\n```python\nif status == 'active':\n    is_active = True\nelse:\n    is_active = False\n```"},
            {"role": "assistant", "content": "```python\nis_active = status == 'active'\n```\n\nThe comparison already returns a boolean — no need for the if/else."},
        ],
    ],
    "configuration > setup_environment": [
        [
            {"role": "user", "content": "How do I set up a Python virtual environment and install dependencies from requirements.txt?"},
            {"role": "assistant", "content": "```bash\npython -m venv venv\nsource venv/bin/activate  # On Windows: venv\\Scripts\\activate\npip install -r requirements.txt\n```\n\nTo deactivate later, just run `deactivate`. To recreate the venv cleanly, delete the `venv/` folder and repeat."},
            {"role": "user", "content": "Got it, thanks."},
        ],
    ],
    "configuration > install_dependency": [
        [
            {"role": "user", "content": "How do I add TypeScript to an existing React project?"},
            {"role": "assistant", "content": "```bash\nnpm install -D typescript @types/react @types/react-dom\nnpx tsc --init\n```\n\nThen rename files from `.jsx` to `.tsx` and `.js` to `.ts`. Fix type errors gradually — you can set `strict: false` in `tsconfig.json` initially and tighten it over time."},
        ],
    ],
    "configuration > configure_tool": [
        [
            {"role": "user", "content": "How do I configure ESLint with Prettier for a TypeScript project?"},
            {"role": "assistant", "content": "Install the packages:\n```bash\nnpm install -D eslint prettier eslint-config-prettier eslint-plugin-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin\n```\n\nCreate `.eslintrc.json`:\n```json\n{\n  \"parser\": \"@typescript-eslint/parser\",\n  \"extends\": [\n    \"eslint:recommended\",\n    \"plugin:@typescript-eslint/recommended\",\n    \"prettier\"\n  ],\n  \"plugins\": [\"prettier\"],\n  \"rules\": {\n    \"prettier/prettier\": \"error\"\n  }\n}\n```\n\nKey: `eslint-config-prettier` goes last in `extends` to disable conflicting rules."},
        ],
    ],
    "data > query_data": [
        [
            {"role": "user", "content": "Write a SQL query to find the top 5 customers by total order value this month."},
            {"role": "assistant", "content": "```sql\nSELECT\n    c.name,\n    SUM(o.total) as total_spent\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nWHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)\nGROUP BY c.id, c.name\nORDER BY total_spent DESC\nLIMIT 5;\n```"},
            {"role": "user", "content": "Can you add the number of orders too?"},
            {"role": "assistant", "content": "```sql\nSELECT\n    c.name,\n    COUNT(o.id) as order_count,\n    SUM(o.total) as total_spent\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nWHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)\nGROUP BY c.id, c.name\nORDER BY total_spent DESC\nLIMIT 5;\n```"},
        ],
    ],
    "data > transform_data": [
        [
            {"role": "user", "content": "I have a list of dicts and need to group them by a key. What's the most Pythonic way?"},
            {"role": "assistant", "content": "Use `itertools.groupby` (requires sorted input) or `defaultdict` (simpler):\n\n```python\nfrom collections import defaultdict\n\ndef group_by(items, key):\n    groups = defaultdict(list)\n    for item in items:\n        groups[item[key]].append(item)\n    return dict(groups)\n\n# Usage\nusers = [{'dept': 'eng', 'name': 'Alice'}, {'dept': 'sales', 'name': 'Bob'}, {'dept': 'eng', 'name': 'Carol'}]\ngroup_by(users, 'dept')\n# {'eng': [{'dept': 'eng', 'name': 'Alice'}, {'dept': 'eng', 'name': 'Carol'}], 'sales': [...]}\n```"},
        ],
    ],
    "documentation > write_docs": [
        [
            {"role": "user", "content": "Write a docstring for this function:\n\n```python\ndef retry(fn, max_attempts=3, delay=1.0, backoff=2.0):\n    for attempt in range(max_attempts):\n        try:\n            return fn()\n        except Exception as e:\n            if attempt == max_attempts - 1:\n                raise\n            time.sleep(delay * (backoff ** attempt))\n```"},
            {"role": "assistant", "content": "```python\ndef retry(fn, max_attempts=3, delay=1.0, backoff=2.0):\n    \"\"\"Retry a function call with exponential backoff.\n\n    Args:\n        fn: Callable to invoke (no arguments).\n        max_attempts: Maximum number of attempts before re-raising.\n        delay: Initial delay in seconds between retries.\n        backoff: Multiplier applied to delay after each attempt.\n\n    Returns:\n        The return value of fn() on success.\n\n    Raises:\n        Exception: The last exception raised by fn after all attempts are exhausted.\n    \"\"\"\n```"},
        ],
    ],
    "planning > design_architecture": [
        [
            {"role": "user", "content": "I'm building a real-time chat app. Should I use WebSockets or SSE?"},
            {"role": "assistant", "content": "**WebSockets** — chat is bidirectional by nature.\n\n- **WebSockets**: Full-duplex, both client and server can send messages anytime. Ideal for chat where users both send and receive. Supported everywhere.\n- **SSE**: Server-to-client only. You'd need a separate POST endpoint for sending messages, adding complexity.\n\nStack recommendation:\n- **Backend**: FastAPI with `websockets` or Node.js with Socket.io\n- **Scaling**: Redis pub/sub to broadcast across multiple server instances\n- **Persistence**: Store messages in Postgres, use WebSocket for real-time delivery\n\nSSE is better for one-way feeds like notifications or live dashboards."},
            {"role": "user", "content": "Makes sense. I'll go with WebSockets and Redis pub/sub."},
        ],
        [
            {"role": "user", "content": "What's the best way to structure a microservices architecture for an e-commerce platform?"},
            {"role": "assistant", "content": "Core services:\n\n1. **API Gateway** — routing, auth, rate limiting\n2. **User Service** — auth, profiles, addresses\n3. **Product Service** — catalog, search, inventory\n4. **Order Service** — cart, checkout, order management\n5. **Payment Service** — payment processing, refunds\n6. **Notification Service** — email, SMS, push\n\nCommunication:\n- **Sync** (REST/gRPC): Gateway → Services for user-facing requests\n- **Async** (message queue): Order placed → Payment → Inventory → Notification\n\nUse an event bus (Kafka/RabbitMQ) for inter-service events. Each service owns its database (database-per-service pattern). Start with a modular monolith if your team is small — extract services as scaling demands."},
        ],
    ],
    "general > other": [
        [
            {"role": "user", "content": "What's a good naming convention for git branches?"},
            {"role": "assistant", "content": "Common pattern: `<type>/<ticket>-<short-description>`\n\nExamples:\n- `feature/PROJ-123-add-user-auth`\n- `fix/PROJ-456-login-redirect-loop`\n- `chore/PROJ-789-update-dependencies`\n\nTypes: `feature`, `fix`, `hotfix`, `chore`, `refactor`, `docs`\n\nKeep descriptions short (3-5 words), use hyphens, lowercase. The ticket number makes it easy to trace branches back to issues."},
        ],
        [
            {"role": "user", "content": "Recommend a good color palette for a dark mode dashboard."},
            {"role": "assistant", "content": "Here's a proven palette:\n\n- **Background**: `#0f1117` (near-black with slight blue)\n- **Surface/Cards**: `#13141b` (slightly lighter)\n- **Borders**: `rgba(255,255,255,0.06)` (subtle)\n- **Primary text**: `#e4e4e7` (zinc-200)\n- **Secondary text**: `#a1a1aa` (zinc-400)\n- **Muted text**: `#71717a` (zinc-500)\n- **Accent**: `#6366f1` (indigo-500) for CTAs\n- **Success**: `#22c55e`, **Warning**: `#eab308`, **Error**: `#ef4444`\n\nAvoid pure white (`#fff`) text — it's too harsh. Stick to zinc/slate gray tones for text hierarchy."},
        ],
    ],
}

# Flatten all conversations and map to intents for picking
ALL_TEMPLATES = []
for intent, templates in CONVERSATIONS_BY_INTENT.items():
    for t in templates:
        ALL_TEMPLATES.append((intent, t))

# Fill remaining intents with a generic template
for intent in INTENTS:
    if intent not in CONVERSATIONS_BY_INTENT:
        ALL_TEMPLATES.append((intent, [
            {"role": "user", "content": f"I need help with {intent.replace(' > ', ': ').replace('_', ' ')}."},
            {"role": "assistant", "content": f"Sure, I can help with that. Here's what I'd recommend for {intent.split(' > ')[1].replace('_', ' ')}..."},
            {"role": "user", "content": "That helps, thank you."},
        ]))


def generate_quality_score() -> int:
    """Generate a quality score averaging ~72, range 40-95."""
    score = int(random.gauss(72, 12))
    return max(40, min(95, score))


def pick_completion_status() -> str:
    statuses = list(COMPLETION_WEIGHTS.keys())
    weights = list(COMPLETION_WEIGHTS.values())
    return random.choices(statuses, weights=weights, k=1)[0]


def random_date_last_30_days() -> str:
    now = datetime.now(timezone.utc)
    offset = random.uniform(0, 30 * 24 * 3600)
    dt = now - timedelta(seconds=offset)
    return dt.isoformat()


def main():
    # Ensure a demo customer exists
    result = sb.table("customers").select("id").eq("name", "Demo Company").execute()
    if result.data:
        customer_id = result.data[0]["id"]
        print(f"Using existing customer: {customer_id}")
    else:
        insert = sb.table("customers").insert({
            "api_key": "cm_demo_key_seed",
            "name": "Demo Company",
        }).execute()
        customer_id = insert.data[0]["id"]
        print(f"Created demo customer: {customer_id}")

    user_ids = [f"user-{str(uuid.uuid4())[:8]}" for _ in range(NUM_USERS)]

    rows = []
    for i in range(NUM_CONVERSATIONS):
        intent, messages = random.choice(ALL_TEMPLATES)
        rows.append({
            "customer_id": customer_id,
            "conversation_id": f"conv-{uuid.uuid4()}",
            "user_id": random.choice(user_ids),
            "messages": messages,
            "metadata": {"source": random.choice(["web_chat", "api", "slack", "vscode"])},
            "intent": intent,
            "quality_score": generate_quality_score(),
            "completion_status": pick_completion_status(),
            "created_at": random_date_last_30_days(),
        })

    # Insert in batches of 50
    BATCH = 50
    inserted = 0
    for start in range(0, len(rows), BATCH):
        batch = rows[start:start + BATCH]
        sb.table("conversations").insert(batch).execute()
        inserted += len(batch)
        print(f"Inserted {inserted}/{NUM_CONVERSATIONS}")

    print(f"\nDone! Seeded {NUM_CONVERSATIONS} conversations for customer '{customer_id}'.")

    # Print summary
    statuses = {}
    intents = {}
    scores = []
    for r in rows:
        statuses[r["completion_status"]] = statuses.get(r["completion_status"], 0) + 1
        intents[r["intent"]] = intents.get(r["intent"], 0) + 1
        scores.append(r["quality_score"])

    print(f"\nCompletion status distribution: {statuses}")
    print(f"Average quality score: {sum(scores) / len(scores):.1f}")
    print(f"Unique intents: {len(intents)}")
    print(f"Top 5 intents: {sorted(intents.items(), key=lambda x: -x[1])[:5]}")


if __name__ == "__main__":
    main()
