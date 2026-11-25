# thapAI: anonymous class voting

A small Next.js app for anonymous polls like "Best boy in the class". Voters pick one
name, and a live leaderboard shows who has the most and the fewest votes. Nobody,
the admin included, can see who voted for whom.

## Setup

1. Create a free database at https://neon.tech and copy its connection string.
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and `ADMIN_PASSWORD`.
3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000/admin, sign in, and create a poll. Your class list is
   already filled in (edit `src/lib/class-names.ts` to change the default).
   Tables are created automatically the first time you sign in.
5. Use **Copy link** on the poll and share it with the class.

## Live site

https://ballotin.vercel.app

## Deploy (Vercel)

Import the folder into Vercel and add the same environment variables
(`DATABASE_URL`, `ADMIN_PASSWORD`, optional `IP_SALT`).

## How double voting is blocked

Each poll has these protections, which you can switch on or off from the dashboard:

| Protection | Default | Notes |
| --- | --- | --- |
| One vote per device | Always on | A cookie. Clearing cookies or using another browser gets around it. |
| One vote per network (IP) | On | Only a salted hash of the IP is stored. Everyone on the same Wi-Fi shares one IP, so only one of them can vote. Ask people to use mobile data, or turn this off and use codes. |
| One-time codes | Off | Strongest option. Print the codes, cut them out, shuffle, and hand them out at random. Each code works once. |

## Why it is anonymous

A vote is one atomic database call (`cast_vote` in `src/lib/db.ts`) that checks the
limits above and adds 1 to the chosen name's total. The database never stores a
record of "this code, IP or device chose this name": there is no votes table and no
vote timestamps. Only the totals per name exist.
