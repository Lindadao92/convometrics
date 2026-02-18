"""
Seed 500 Lovable-style demo conversations into Supabase.
Run from backend/:  python -m scripts.seed_lovable_data
"""

import os, random, uuid
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

# ── Intent config ─────────────────────────────────────────────────────────────
# (intent, weight, avg_quality, completion_weights [completed,partial,abandoned,failed])
INTENTS = [
    ("scaffold_app",   15, 88, [78, 14,  6,  2]),
    ("add_feature",    18, 61, [45, 25, 20, 10]),
    ("fix_bug",        14, 52, [35, 20, 25, 20]),
    ("change_styling", 10, 82, [70, 18,  8,  4]),
    ("connect_api",     7, 41, [25, 20, 35, 20]),
    ("make_responsive", 6, 48, [38, 22, 25, 15]),
    ("add_auth",        5, 65, [55, 20, 15, 10]),
    ("deploy_app",      5, 75, [65, 20, 10,  5]),
    ("fix_break_loop",  4, 34, [12, 15, 40, 33]),
    # remaining ~16% spread across lower-volume intents
    ("add_database",    4, 63, [48, 22, 20, 10]),
    ("add_payments",    3, 55, [40, 20, 25, 15]),
    ("custom_domain",   2, 79, [68, 18, 10,  4]),
    ("recreate_design", 3, 44, [30, 25, 28, 17]),
    ("restructure",     2, 71, [58, 22, 15,  5]),
    ("dark_mode",       2, 78, [65, 20, 10,  5]),
]
INTENT_NAMES   = [x[0] for x in INTENTS]
INTENT_WEIGHTS = [x[1] for x in INTENTS]
INTENT_QUALITY = {x[0]: x[2] for x in INTENTS}
INTENT_COMP    = {x[0]: x[3] for x in INTENTS}

# ── Lovable-style message pools ───────────────────────────────────────────────
MESSAGES = {
    "scaffold_app": [
        [
            {"role": "user", "content": "Build me a project management app with kanban boards and drag-and-drop cards"},
            {"role": "assistant", "content": "Building your kanban app! I'm creating columns for To Do, In Progress, and Done, with draggable cards, card creation modals, and a clean dashboard layout. Using shadcn components for a polished look..."},
            {"role": "user", "content": "Love it! Can you add due dates to cards?"},
            {"role": "assistant", "content": "Adding due dates with a date picker and overdue highlighting in red. Updating now..."},
        ],
        [
            {"role": "user", "content": "Create a restaurant booking system with table management"},
            {"role": "assistant", "content": "Building your restaurant booking app! Floor plan layout, reservation form, real-time availability, and admin dashboard. Generating now..."},
        ],
        [
            {"role": "user", "content": "Build a SaaS analytics dashboard for tracking user metrics"},
            {"role": "assistant", "content": "Creating your analytics dashboard with overview cards, line charts for trends, bar charts for top events, and a date range picker. Using Recharts for visualization..."},
        ],
        [
            {"role": "user", "content": "Make me a personal portfolio website with a projects section and contact form"},
            {"role": "assistant", "content": "Building your portfolio! Hero with animated text, projects grid with tech badges, skills section, and a working contact form. Clean modern design incoming..."},
        ],
        [
            {"role": "user", "content": "Build a habit tracker app with daily check-ins and streaks"},
            {"role": "assistant", "content": "Creating your habit tracker! Daily check-in UI, streak counter with flame animation, weekly calendar view, and completion stats. Building now..."},
        ],
        [
            {"role": "user", "content": "Build me an e-commerce store with product listings and a cart"},
            {"role": "assistant", "content": "Building your e-commerce app! Product grid with search and filters, product detail pages, shopping cart with quantity management, and a checkout flow. Generating now..."},
        ],
    ],
    "add_feature": [
        [
            {"role": "user", "content": "Add a notifications system with a bell icon and unread count"},
            {"role": "assistant", "content": "Adding notifications! Bell icon with badge, dropdown with mark-as-read, and notification types for mentions and updates. Updating now..."},
            {"role": "user", "content": "The bell shows but clicking it doesn't open the dropdown"},
            {"role": "assistant", "content": "Found the issue — z-index conflict with the header. Fixing the click handler and repositioning the dropdown..."},
        ],
        [
            {"role": "user", "content": "Add a dark mode toggle to the navbar"},
            {"role": "assistant", "content": "Adding dark mode! Sun/moon toggle, system preference detection, localStorage persistence, and smooth transition. Updating all components with dark: variants..."},
            {"role": "user", "content": "Toggle works but the sidebar is still white in dark mode"},
            {"role": "assistant", "content": "Missed the sidebar dark classes. Adding dark: variants to all sidebar components now..."},
        ],
        [
            {"role": "user", "content": "Add search functionality to the products page"},
            {"role": "assistant", "content": "Adding real-time search with 300ms debounce, category and price filters, results count, and shareable URL params. Updating now..."},
        ],
        [
            {"role": "user", "content": "Add export to CSV for the reports section"},
            {"role": "assistant", "content": "Adding CSV export! Column selector, date range filter, loading state, and auto-named file with timestamp. Updating now..."},
        ],
        [
            {"role": "user", "content": "Add pagination to the data table"},
            {"role": "assistant", "content": "Adding pagination with page size selector (10/25/50), prev/next navigation, page jump, and total count display. Updating now..."},
        ],
    ],
    "fix_bug": [
        [
            {"role": "user", "content": "I added a new feature and now the dashboard is broken"},
            {"role": "assistant", "content": "Found it — the new hook is missing a dependency array causing infinite re-renders. Fixing and adding an error boundary to prevent future cascades..."},
            {"role": "user", "content": "Dashboard loads now but the chart data is wrong"},
            {"role": "assistant", "content": "The date filter in the chart data hook is accidentally excluding data. Fixing the range logic now..."},
        ],
        [
            {"role": "user", "content": "The login button does nothing when I click it"},
            {"role": "assistant", "content": "Found two issues: missing e.preventDefault() on the form submit, and a trailing slash in the API URL causing a 404. Fixing both now..."},
            {"role": "user", "content": "It submits now but says invalid credentials with the right password"},
            {"role": "assistant", "content": "Password is being double-hashed — on the client AND server. Removing the client-side hash since the server handles it securely..."},
        ],
        [
            {"role": "user", "content": "Images aren't loading on the product pages in production"},
            {"role": "assistant", "content": "Image URLs are using relative paths but production serves from a CDN subdirectory. Updating to use NEXT_PUBLIC_CDN_URL as prefix..."},
        ],
        [
            {"role": "user", "content": "Getting a blank white screen after clicking submit on checkout"},
            {"role": "assistant", "content": "JavaScript crash on submit — price calculation divides by zero when discount is 100%. Adding validation and fixing the edge case now..."},
            {"role": "user", "content": "Still getting a white screen"},
            {"role": "assistant", "content": "Different issue — the success redirect has undefined orderId because the API response parsing is wrong. Fixing the response handler..."},
        ],
    ],
    "change_styling": [
        [
            {"role": "user", "content": "The button color should be blue not purple"},
            {"role": "assistant", "content": "Switching primary color to #2563EB (blue-600) across the design system. All buttons, links, and accents updated..."},
        ],
        [
            {"role": "user", "content": "Everything feels too small, make the font bigger and easier to read"},
            {"role": "assistant", "content": "Bumping base font 14→16px, scaling headings proportionally, increasing line-height to 1.65, darkening body text. Updating now..."},
            {"role": "user", "content": "Better! But headers are too big on mobile now"},
            {"role": "assistant", "content": "Adding fluid typography with clamp() so headings scale smoothly between breakpoints..."},
        ],
        [
            {"role": "user", "content": "The landing page hero looks plain, make it more impressive"},
            {"role": "assistant", "content": "Upgrading hero! Gradient background with animated mesh, typewriter headline effect, glowing CTA button, and a stats strip below. Updating..."},
        ],
        [
            {"role": "user", "content": "Change the sidebar from dark to a light theme"},
            {"role": "assistant", "content": "Switching sidebar: bg #1e293b→white, text white→#1e293b, active state to blue tint with left border accent, adding right border divider..."},
        ],
        [
            {"role": "user", "content": "Add animations to make the app feel more polished"},
            {"role": "assistant", "content": "Adding tasteful animations: page fade-in, card hover lift, button press scale, skeleton shimmer, toast slide-in, modal transitions. Using Framer Motion..."},
        ],
    ],
    "connect_api": [
        [
            {"role": "user", "content": "Connect to the Stripe API for payments"},
            {"role": "assistant", "content": "Integrating Stripe! Frontend Elements, payment intent creation, secure card form, success/failure handling, webhook handler. Add your STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY env vars..."},
            {"role": "user", "content": "Payment form doesn't load — just a blank box"},
            {"role": "assistant", "content": "Stripe Elements loading before env vars are initialized. Moving initialization to ensure it runs after vars are available..."},
            {"role": "user", "content": "Form loads now but payment fails with 'No such payment method'"},
            {"role": "assistant", "content": "You're mixing test and live keys — both must be test keys (pk_test_ / sk_test_). Fixing the key validation..."},
        ],
        [
            {"role": "user", "content": "Integrate Mailchimp so users can subscribe to my newsletter"},
            {"role": "assistant", "content": "Integrating Mailchimp API v3! Subscribe endpoint, email validation, success/error states, double opt-in. You'll need API key, audience ID, and datacenter prefix (e.g. us14)..."},
            {"role": "user", "content": "Getting a 404 from Mailchimp"},
            {"role": "assistant", "content": "The datacenter in the URL is wrong — it should be the suffix of your API key after the dash. Fixing the URL construction..."},
        ],
        [
            {"role": "user", "content": "Add Google Maps to show our store locations"},
            {"role": "assistant", "content": "Adding Google Maps with store markers, info windows, nearby store search, and user location detection. Add NEXT_PUBLIC_GOOGLE_MAPS_KEY to env..."},
            {"role": "user", "content": "Map shows but all markers are in the wrong location"},
            {"role": "assistant", "content": "Latitude and longitude are swapped in the store data — Google Maps expects {lat, lng} but data has [lng, lat]. Fixing coordinate order..."},
        ],
    ],
    "make_responsive": [
        [
            {"role": "user", "content": "The navbar is overlapping the hero section on mobile"},
            {"role": "assistant", "content": "Navbar is position:fixed without offsetting hero padding-top. Adding pt-16 to hero, collapsing nav to hamburger on mobile, fixing z-index..."},
            {"role": "user", "content": "Navbar fixed but footer text is cut off on small screens"},
            {"role": "assistant", "content": "Footer columns need to stack vertically on mobile. Updating to single-column mobile → 2-col tablet → 4-col desktop..."},
        ],
        [
            {"role": "user", "content": "The dashboard looks terrible on mobile — everything is too wide"},
            {"role": "assistant", "content": "Fixing mobile dashboard: table gets horizontal scroll, metric cards stack 2→1 col, charts get responsive heights, sidebar collapses to drawer..."},
            {"role": "user", "content": "Better but the chart is still overflowing"},
            {"role": "assistant", "content": "Chart has a fixed minWidth. Setting to 100% and using ResponsiveContainer properly to fill available space..."},
        ],
        [
            {"role": "user", "content": "Product grid shows 4 columns on mobile, should be 1 or 2"},
            {"role": "assistant", "content": "Changing grid-cols-4 to grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 for proper responsive behavior..."},
            {"role": "user", "content": "Good but the card images are stretched vertically now"},
            {"role": "assistant", "content": "Adding aspect-[4/3] to the image container with object-cover so images fill without distorting..."},
        ],
    ],
    "add_auth": [
        [
            {"role": "user", "content": "Add user authentication with Google sign-in"},
            {"role": "assistant", "content": "Setting up Google OAuth with NextAuth.js! Sign-in page, session management, protected routes, and persistent sessions. Add your Google OAuth credentials..."},
            {"role": "user", "content": "Google button shows but I get an OAuth error on click"},
            {"role": "assistant", "content": "Redirect URI mismatch. Add http://localhost:3000/api/auth/callback/google to authorized redirect URIs in Google Console..."},
        ],
        [
            {"role": "user", "content": "Add magic link passwordless email login"},
            {"role": "assistant", "content": "Implementing magic links with Supabase Auth! User enters email → link sent → click to auto-login → expires in 15 minutes. Building now..."},
        ],
        [
            {"role": "user", "content": "Add role-based access control with admin, editor, and viewer roles"},
            {"role": "assistant", "content": "Adding RBAC! Role field on users, route-level protection, conditional UI by role, admin panel, Supabase RLS policies at the DB level. Building..."},
            {"role": "user", "content": "Admins see the panel but viewers can access it if they know the URL"},
            {"role": "assistant", "content": "Page is only hiding the nav link, not protecting the route. Adding server-side auth check that redirects before the page renders..."},
        ],
    ],
    "deploy_app": [
        [
            {"role": "user", "content": "Deploy this app to Vercel"},
            {"role": "assistant", "content": "Preparing for Vercel! Creating vercel.json, documenting env vars, fixing hardcoded localhost URLs, checking build command. Push to GitHub, connect at vercel.com, add env vars, deploy!"},
        ],
        [
            {"role": "user", "content": "App works locally but the Vercel build fails"},
            {"role": "assistant", "content": "Common causes: missing env vars, TypeScript errors, or case-sensitive import paths. Found it — import uses ./Components/Header but file is ./components/Header (Linux is case-sensitive). Fixing all paths..."},
            {"role": "user", "content": "Build passes now but app shows a 500 error"},
            {"role": "assistant", "content": "500 after a clean build = missing env vars in Vercel. Check Function logs in dashboard — it'll show which var is undefined. Add all .env vars to Vercel's Environment Variables settings."},
        ],
    ],
    "fix_break_loop": [
        [
            {"role": "user", "content": "I added a feature and now the whole page is broken"},
            {"role": "assistant", "content": "Found the issue — new hook causing infinite re-render loop. Fixing dependency array..."},
            {"role": "user", "content": "It's still broken, the sidebar disappeared too"},
            {"role": "assistant", "content": "Sidebar import got accidentally removed during the fix. Adding it back and fixing the z-index..."},
            {"role": "user", "content": "Sidebar is back but the data table shows wrong data"},
            {"role": "assistant", "content": "The dependency array change broke the data refresh on filter change. Switching to a ref-based approach..."},
            {"role": "user", "content": "Filters are broken now"},
            {"role": "assistant", "content": "Filter and data state are tightly coupled. Refactoring to separate concerns..."},
            {"role": "user", "content": "Now the whole page is blank again"},
            {"role": "assistant", "content": "Syntax error crept in during refactor. Fixing the missing bracket and reviewing everything carefully this time..."},
            {"role": "user", "content": "Can you just make it work like it did before?"},
            {"role": "assistant", "content": "Reverting to the last stable version and making the minimal change needed for the original feature. Starting fresh from the working state..."},
        ],
        [
            {"role": "user", "content": "Form submission keeps throwing a network error"},
            {"role": "assistant", "content": "CORS issue — API endpoint isn't allowing your domain. Adding the correct CORS headers..."},
            {"role": "user", "content": "CORS gone but now getting 400 bad request"},
            {"role": "assistant", "content": "Field name mismatch — form sends fullName but API expects full_name. Fixing the mapping..."},
            {"role": "user", "content": "Still 400, field names look right now"},
            {"role": "assistant", "content": "Empty email field is sent as empty string instead of null, failing validation. Updating form serialization..."},
            {"role": "user", "content": "Now getting a 500"},
            {"role": "assistant", "content": "Phone field expected as string but form sends number (input type='number'). Changing to type='tel' and ensuring string output..."},
            {"role": "user", "content": "Form submits! But success message doesn't show"},
            {"role": "assistant", "content": "Success state cleared before toast renders — finally block runs too early. Restructuring promise chain..."},
        ],
    ],
    "add_database": [
        [
            {"role": "user", "content": "Add a database to store user posts and comments"},
            {"role": "assistant", "content": "Setting up Supabase Postgres! Tables: posts (id, user_id, title, content, created_at) and comments (id, post_id, user_id, content). Adding RLS so users only edit their own posts. Migration SQL in supabase/migrations/..."},
        ],
    ],
    "add_payments": [
        [
            {"role": "user", "content": "Add Stripe so users can subscribe to a monthly plan"},
            {"role": "assistant", "content": "Adding Stripe subscriptions! Checkout flow, plan selection (monthly/annual), webhook handler for lifecycle events, subscription status gating, customer portal for billing management..."},
        ],
    ],
    "custom_domain": [
        [
            {"role": "user", "content": "Set up a custom domain for my app"},
            {"role": "assistant", "content": "Steps: 1) In Vercel: Settings → Domains → Add domain. 2) In DNS: CNAME to cname.vercel-dns.com for subdomains, or A record 76.76.21.21 for apex. SSL auto-provisioned by Vercel. DNS propagation: up to 48h but usually faster!"},
        ],
    ],
    "recreate_design": [
        [
            {"role": "user", "content": "Make it look like this design [screenshot attached]"},
            {"role": "assistant", "content": "Recreating from your screenshot! I can see: white card layout with subtle shadows, Inter font, blue primary #3B82F6, stats row with icon+value+label, icon-only sidebar. Building to match..."},
            {"role": "user", "content": "Close but spacing is wrong and cards don't match"},
            {"role": "assistant", "content": "Refining: card padding 16→24px, gap 12→16px, softer shadow (blur 20px, 8% opacity), border-radius 8→12px..."},
            {"role": "user", "content": "Font weights are off and the header doesn't match"},
            {"role": "assistant", "content": "From your screenshot: header bg #1e293b (dark navy, not black), 64px height, Inter weight 500 for nav / 600 for headings, user avatar top-right. Updating..."},
        ],
    ],
    "restructure": [
        [
            {"role": "user", "content": "The codebase is getting messy, can you organize the components folder?"},
            {"role": "assistant", "content": "Restructuring to: /ui (design system), /layout (Header, Sidebar, Footer), /features/auth + /features/dashboard + /features/settings, /shared (reusable across features). Updating all imports..."},
        ],
    ],
    "dark_mode": [
        [
            {"role": "user", "content": "Add a dark mode toggle that saves the user's preference"},
            {"role": "assistant", "content": "Adding dark mode! Sun/moon toggle in header, system preference detection via prefers-color-scheme, localStorage persistence, smooth CSS transition, all components updated with dark: variants..."},
        ],
    ],
}

STATUSES = ["completed", "partial", "abandoned", "failed"]
USER_EXPERIENCES = ["beginner", "designer", "developer"]
EXP_WEIGHTS = [50, 30, 20]
PROJECT_TYPES = ["saas", "landing_page", "marketplace", "portfolio", "internal_tool"]

PROMPT_RANGES = {
    "scaffold_app":    (1, 4),
    "add_feature":     (2, 8),
    "fix_bug":         (3, 10),
    "change_styling":  (1, 5),
    "connect_api":     (3, 10),
    "make_responsive": (2, 7),
    "add_auth":        (2, 6),
    "deploy_app":      (1, 4),
    "fix_break_loop":  (5, 15),
    "add_database":    (2, 7),
    "add_payments":    (3, 9),
    "custom_domain":   (1, 3),
    "recreate_design": (2, 8),
    "restructure":     (2, 6),
    "dark_mode":       (1, 3),
}


def pick_intent():
    return random.choices(INTENT_NAMES, weights=INTENT_WEIGHTS, k=1)[0]


def pick_status(intent):
    w = INTENT_COMP.get(intent, [45, 25, 20, 10])
    return random.choices(STATUSES, weights=w, k=1)[0]


def pick_quality(intent, is_recent):
    avg = INTENT_QUALITY.get(intent, 60)
    if is_recent:
        avg -= 5           # simulated model dip last 7 days
    std = 10 if avg >= 65 else 14
    return max(10, min(99, int(random.gauss(avg, std))))


def pick_messages(intent):
    pool = MESSAGES.get(intent)
    if pool:
        return random.choice(pool)
    return [
        {"role": "user", "content": f"Help me with {intent.replace('_', ' ')}"},
        {"role": "assistant", "content": f"Sure! Working on {intent.replace('_', ' ')} now..."},
    ]


def rand_date(now, is_recent):
    if is_recent:
        secs = random.uniform(0, 7 * 86400)
    else:
        secs = random.uniform(7 * 86400, 30 * 86400)
    return (now - timedelta(seconds=secs)).isoformat()


def main():
    # 1. Delete all existing conversations
    print("Deleting existing conversations...")
    sb.table("conversations").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("Done.")

    # 2. Get or create customer
    res = sb.table("customers").select("id").limit(1).execute()
    if res.data:
        customer_id = res.data[0]["id"]
        print(f"Using customer: {customer_id}")
    else:
        ins = sb.table("customers").insert({"api_key": "cm_lovable_seed", "name": "Lovable Demo"}).execute()
        customer_id = ins.data[0]["id"]
        print(f"Created customer: {customer_id}")

    # 3. Fixed user pool with assigned experience levels
    user_ids = [f"user-{str(uuid.uuid4())[:8]}" for _ in range(50)]
    user_exp = {u: random.choices(USER_EXPERIENCES, weights=EXP_WEIGHTS, k=1)[0] for u in user_ids}

    proj_weights_by_exp = {
        "beginner":  [35, 30, 10, 20,  5],
        "designer":  [20, 25, 10, 35, 10],
        "developer": [30,  5, 25,  5, 35],
    }

    # 4. Build rows — 30% in last 7 days (recent), 70% in days 7-30
    now = datetime.now(timezone.utc)
    rows = []
    for i in range(500):
        is_recent = i < 150       # first 150 will be recent, shuffled later
        intent  = pick_intent()
        user_id = random.choice(user_ids)
        exp     = user_exp[user_id]
        lo, hi  = PROMPT_RANGES.get(intent, (1, 8))

        rows.append({
            "customer_id":       customer_id,
            "conversation_id":   f"conv-{uuid.uuid4()}",
            "user_id":           user_id,
            "messages":          pick_messages(intent),
            "intent":            intent,
            "quality_score":     pick_quality(intent, is_recent),
            "completion_status": pick_status(intent),
            "created_at":        rand_date(now, is_recent),
            "metadata": {
                "user_experience":        exp,
                "prompt_count_in_session": random.randint(lo, hi),
                "project_type":           random.choices(
                                              PROJECT_TYPES,
                                              weights=proj_weights_by_exp[exp],
                                              k=1
                                          )[0],
            },
        })

    random.shuffle(rows)

    # 5. Insert in batches of 50
    BATCH = 50
    inserted = 0
    for start in range(0, len(rows), BATCH):
        sb.table("conversations").insert(rows[start:start + BATCH]).execute()
        inserted += len(rows[start:start + BATCH])
        print(f"  {inserted}/500 inserted")

    # 6. Summary
    from collections import Counter, defaultdict
    status_counts = Counter(r["completion_status"] for r in rows)
    intent_counts = Counter(r["intent"] for r in rows)
    intent_scores = defaultdict(list)
    for r in rows:
        intent_scores[r["intent"]].append(r["quality_score"])

    print(f"\n✓ Seeded 500 conversations for customer {customer_id}")
    print(f"\nCompletion: {dict(status_counts)}")
    print(f"\nIntent breakdown (count · avg quality):")
    for intent, count in intent_counts.most_common():
        scores = intent_scores[intent]
        avg = sum(scores) / len(scores)
        target = INTENT_QUALITY.get(intent, "?")
        print(f"  {intent:<20} {count:>3}  quality {avg:4.1f}  (target {target})")

    all_scores = [r["quality_score"] for r in rows]
    recent_scores = [r["quality_score"] for r in rows
                     if r["created_at"] > (now - timedelta(days=7)).isoformat()]
    older_scores  = [r["quality_score"] for r in rows
                     if r["created_at"] <= (now - timedelta(days=7)).isoformat()]
    print(f"\nOverall avg quality:    {sum(all_scores)/len(all_scores):.1f}")
    if recent_scores:
        print(f"Last 7d avg quality:    {sum(recent_scores)/len(recent_scores):.1f}  ← model dip")
    if older_scores:
        print(f"Prior 23d avg quality:  {sum(older_scores)/len(older_scores):.1f}")


if __name__ == "__main__":
    main()
