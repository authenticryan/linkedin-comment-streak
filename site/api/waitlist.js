import { neonDb } from "../lib/db.js";
import { createWaitlist } from "../lib/waitlist.js";

const handle = createWaitlist({ db: neonDb(process.env.DATABASE_URL) });

export default { fetch: handle };
