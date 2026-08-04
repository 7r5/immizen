export const COMMIT_INFO =
    typeof __APP_COMMIT_INFO__ !== "undefined"
        ? __APP_COMMIT_INFO__
        : { hash: "unknown", subject: "commit unavailable" };