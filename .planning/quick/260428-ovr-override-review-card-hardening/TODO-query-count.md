# TODO: Review `/job-targeting/override` Query Count Separately

The pipeline trace showed `db.query_count_threshold_exceeded` with 20 unique queries and no suspected N+1.

Do not mix this with override review card UX hardening. Review the `/job-targeting/override` flow in a separate task focused only on query count and database access shape.

