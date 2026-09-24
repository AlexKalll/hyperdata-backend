# Mahder Netcup Operations and E2E Showcase Runbook

**Status:** Active temporary showcase setup
**Server:** Netcup VPS `5.181.48.134`
**SSH alias:** `mahder-netcup`
**Hyperdata root:** `/home/deploy/hyperdata`

This runbook records the commands and test data used for the current Hyperdata deployment. It is intentionally free of password values and private keys.

## 1. Public URLs

```text
Frontend: https://mahder.duckdns.org
API:      https://mahder-api.duckdns.org/api
Storage:  https://mahder-storage.duckdns.org
```

The storage endpoint is intentionally still enabled for this quarter:

```caddyfile
mahder-storage.duckdns.org {
    reverse_proxy 127.0.0.1:9000
}
```

The bucket remains private. Applications receive signed MinIO URLs rather than public object permissions. Do not remove `MINIO_PUBLIC_ENDPOINT` or the storage Caddy route until the planned backend file-proxy refactor is complete.

## 2. Sensitive credentials

Temporary showcase credentials are stored only on the VPS:

```text
/home/deploy/hyperdata/run/mahder-e2e-credentials.md
```

The file is protected with mode `600`. View it privately from an administrator terminal only:

```powershell
ssh mahder-netcup 'stat -c "%a %n" /home/deploy/hyperdata/run/mahder-e2e-credentials.md'
ssh mahder-netcup 'cat /home/deploy/hyperdata/run/mahder-e2e-credentials.md'
```

Do not commit, email, or paste that file into chat. These are temporary presentation credentials and must be rotated or deleted after the showcase.

The existing SuperAdmin password is also kept in:

```text
/home/deploy/hyperdata/run/admin-initial-password
```

## 3. Current showcase users

The six current showcase accounts below are active. Passwords are in the server-only credentials file.

| Role | Email | Phone login | User ID |
|---|---|---|---|
| SuperAdmin | `admin@gmail.com` | — | `ce1f55fe-9002-4b55-b21a-64d9224f4839` |
| ProjectManager | `pm@gmail.com` | — | `a21c979c-06d5-41dc-ad6a-d7a53ecd358e` |
| Facilitator | `faci@gmail.com` | — | `7c8803f0-9ecb-42d9-9f2b-998a8d73de12` |
| Reviewer | `rev@gmail.com` | `+251345678900` | `51ae9a65-66f7-4542-8ec0-ba89df9f1271` |
| Contributor | `cont1@gmail.com` | `+251123456789` | `6ff070dd-3b26-4507-afb0-fbaeb2a8bb5e` |
| Contributor | `cont2@gmail.com` | `+251234567890` | `56b37d84-f336-45b2-aa8b-006a766a54b3` |

The authoritative list is always the VPS credentials file and database.

## 4. Login endpoints

### Web/API users

```http
POST https://mahder-api.duckdns.org/api/iam/auth/login
Content-Type: application/json

{"username":"EMAIL","password":"PASSWORD"}
```

Use this for SuperAdmin, ProjectManager, Facilitator, and the web Reviewer dashboard.

### Mobile users

```http
POST https://mahder-api.duckdns.org/api/iam/auth/mobile_login
Content-Type: application/json

{"username":"PHONE","password":"PASSWORD","device_type":"android"}
```

Use this for contributors and optional mobile Reviewer authentication. Valid device types are `android`, `ios`, and `web`.
The mobile app displays a `+251` prefix; enter only the nine local digits shown in
the phone column. The review workflow itself is performed in the web Reviewer
dashboard with `rev@gmail.com`.

## 5. Safe Hyperdata status commands

Always use the explicit Hyperdata Compose project and file. Do not run unscoped `docker compose down`, `docker system prune`, or volume-prune commands on this shared VPS.

```bash
docker compose --project-name hyperdata \
  --env-file /home/deploy/hyperdata/secrets/compose.env \
  -f /home/deploy/hyperdata/src/hyperdata-backend/deploy/docker-compose.production.yml ps
```

```bash
docker compose --project-name hyperdata \
  --env-file /home/deploy/hyperdata/secrets/compose.env \
  -f /home/deploy/hyperdata/src/hyperdata-backend/deploy/docker-compose.production.yml logs --tail=100 backend
```

Check the existing applications separately:

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep -E '^(hrm-|icog-)' | sort
```

## 6. Caddy validation and reload

The active proxy is the root-owned host Caddy. Do not recreate or network-connect the stale `hrm-caddy` container.

```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl is-active caddy
systemctl is-enabled caddy
systemctl reload caddy
```

Inspect only the Mahder routes:

```bash
grep -n -A2 -B1 'mahder' /etc/caddy/Caddyfile
```

Expected routes:

```text
mahder.duckdns.org         -> 127.0.0.1:3001
mahder-api.duckdns.org     -> 127.0.0.1:3000
mahder-storage.duckdns.org -> 127.0.0.1:9000
```

## 7. Public health checks

From Windows PowerShell:

```powershell
foreach($u in @(
  'https://mahder.duckdns.org/',
  'https://mahder-api.duckdns.org/api/health',
  'https://mahder-storage.duckdns.org/minio/health/ready'
)){ curl.exe -sS -o NUL -w "$u -> %{http_code} %{url_effective}`n" $u }
```

Expected results:

```text
Frontend: 307, followed by 200 at /login?callbackUrl=%2F
API:      200
Storage:  200
```

## 8. List users without exposing passwords

```bash
ROOT=/home/deploy/hyperdata
docker compose --project-name hyperdata \
  --env-file "$ROOT/secrets/compose.env" \
  -f "$ROOT/src/hyperdata-backend/deploy/docker-compose.production.yml" \
  exec -T postgres psql -U mahder_db -d mahder_db -c \
  "SELECT u.id,u.email,r.name AS role,u.phone_number,u.is_active
   FROM users u JOIN role r ON r.id=u.role_id
   WHERE u.email IN ('admin@gmail.com','pm@gmail.com','faci@gmail.com',
      'rev@gmail.com','cont1@gmail.com','cont2@gmail.com')
   ORDER BY r.name,u.email;"
```

SuperAdmin is the only administrative role retained for the current showcase. No separate Admin role is required.

## 9. Completed text-to-speech showcase records

The retained labeled E2E records are:

```text
Project:   fddacb71-a30f-4945-84c7-33fb20aefd22
Task:      d93dcf67-1e0c-4f3f-a416-da4396c4f3c6
Microtask: 46fbe3b6-0b11-4b6f-8d84-c44f1c64754d
Dataset:   26300960-3e1f-4851-90d2-abfb3c646a01
```

Verified flow:

1. SuperAdmin login through public API.
2. Text-audio task and Amharic phrase micro-task creation.
3. Contributor assignment and task distribution.
4. Contributor mobile login.
5. Valid WAV upload through `contribute_audio`.
6. Background upload to private MinIO.
7. Signed URL download of the stored audio object.
8. Dataset queue status `completed` and object key beginning with `audios/`.

The project is assigned to `pm@gmail.com` for dashboard demonstration. The retained
dataset contains an Amharic source phrase and was created by an earlier temporary
contributor account; it proves the upload/private-storage path, but it is not
evidence of the current six-account review or payment workflow. Use the fresh
four-phrase workflow in the next section for that.

## 10. Complete click-by-click role-based E2E workflow

This is the clean showcase path for the current six accounts. It creates a new
private text-to-speech (`text-audio`) task with Amharic phrases, submits four
audio datasets from the two contributors, approves the correct recordings,
rejects one deliberately incorrect recording, retries it, and verifies the
resulting wallet credits. Do not reuse an old task when recording a new result.

### 10.1 Prepare browser and device sessions

1. Open `https://mahder.duckdns.org/login` in a private window or a separate
   browser profile.
2. Use separate profiles/tabs for SuperAdmin, ProjectManager, Reviewer, and
   Facilitator where possible. Otherwise use the top-bar account menu -> **Log
   Out** before changing roles.
3. Keep the password in the VPS-only credential file. Never put it in screenshots,
   shell history, this runbook, or a bug report.
4. Keep the Android app pointed at the production API. For a physical-device
   test, install the verified APK listed in the project handoff; do not use a
   development `localhost` URL.
5. Record the new project ID, task ID, four microtask codes, and every dataset
   code as the workflow progresses.

### 10.2 Prepare review reference data as SuperAdmin

1. Log in at `/login` as `admin@gmail.com` using the private password.
2. Open **Base Data** -> **Annotation Type**.
3. Reuse an existing suitable annotation type, or click **Add Annotation-type**
   and create `Netcup E2E Amharic TTS Quality`. Reload and confirm the row remains.
4. Open **Base Data** -> **Annotation** -> **Add Annotation**.
5. Create `Netcup E2E Correct TTS`, description `The recording matches the
   displayed Amharic phrase`, and select `Netcup E2E Amharic TTS Quality` as its
   annotation type. Click **Create**, reload, and confirm it is selectable.
6. Open **Base Data** -> **Rejection Type** -> **Add Rejection Type**.
7. Create `Netcup E2E Incorrect TTS`, description `The recording does not match
   the displayed Amharic phrase`. Click **Create** and confirm the row.

If these rows already exist, reuse them. Do not create duplicates on every run.

### 10.3 Create a project and assign the ProjectManager

1. Still as SuperAdmin, open **Project Management** -> `/superadmin/project`.
2. Click **New Project**. The dialog title is **Add Project**.
3. Enter a unique name, for example `Netcup E2E Amharic TTS Run <UTC timestamp>`.
4. Enter a short description such as `Amharic TTS; two contributors, one
   facilitator, one reviewer; approval and rejection payment check`.
5. Select today as **Start Date** and a date at least one day later as **End Date**.
6. Under **Media**, click **Browse Files** and select a harmless local PNG or JPG.
7. Add tags `netcup-e2e`, `tts`, and `amharic` using **Add Tag**.
8. Under **Invite Project Manager**, search for and select `pm@gmail.com`.
9. Click **Save**. Search for the unique name again, open the project, and verify
   the manager, dates, image, and tags after reload.
10. Record the project ID from the URL, then log out.

### 10.4 Create the task as ProjectManager

1. Log in as `pm@gmail.com` and open **Projects** -> `/projectmanager/project`.
2. Find the new project and click **View Project**.
3. Select **Tasks** -> **New Task**. Complete the **Create Task** wizard as follows:

| Field | Value |
|---|---|
| Name | `Netcup E2E Amharic TTS Review <same run name>` |
| Task Type | `text-audio` (Text to Speech) |
| Description | `Read each displayed Amharic phrase aloud exactly as written.` |
| Language | `Amharic` |
| Public | Off/private |
| Require contributor test | Off |
| Maximum submission per microtask | `1` |
| Maximum expected total contributors | `2` |
| Maximum microtasks per contributor | `2` |
| Maximum assignment per reviewer | `4` |
| Maximum contributors per facilitator | `2` |
| Contributors completion time | `1` day |
| Reviewer completion time | `1` day |
| Reviewer payment per review | `1` |
| Contributor payment per approved contribution | `1` |
| Approximate time to finish | `1` |
| Minimum Recording Length | `2` seconds |
| Maximum Audio Seconds | `10` seconds |
| Maximum retry per microtask | `2` |
| Batch size | `2` |

4. Click **Continue** after Task Details and Task Configuration.
5. In Contributor Requirements, leave **Dialect Specific**, **Gender Specific**,
   **Age Specific**, **Sector Specific**, and **Location Specific** off.
6. Click **Create Task**, open it with **View Details**, and record the task ID.
7. Reload and confirm the task is private, has no contributor test, and shows both
   payment values before distributing anything.

After selecting `text-audio`, use the displayed **Minimum Recording Length** and
**Maximum Audio Seconds** fields. Do not select `audio-text`: that is the reverse
workflow. Keep recordings between 2 and 10 seconds so the mobile duration
validation is exercised without rejecting natural speech. Payment values cannot
be changed after distribution starts.

### 10.5 Add the instruction and four microtasks

1. In the task page open **Overview** -> **Task Instruction** -> **Add Instruction**.
2. Set title to `Netcup Amharic TTS instructions`.
3. Set content to `Read the displayed Amharic phrase exactly as written. Speak
   clearly at a natural pace. Record between 2 and 10 seconds.`
4. Leave audio and video instruction URLs blank, click **Save**, and reload.
5. Open **Micro Tasks** -> **New Micro Task** -> **Single Micro Task**.
6. Create the following four records, clicking **Create Micro Task** after each:

| Item | Text (Amharic phrase) | Instruction |
|---|---|---|
| 1 | `ሰላም፣ እንዴት ነህ?` | `Read this phrase exactly, including punctuation.` |
| 2 | `ዛሬ መልካም ቀን ነው።` | `Read this phrase exactly, including punctuation.` |
| 3 | `እንኳን ደህና መጡ።` | `Read this phrase exactly, including punctuation.` |
| 4 | `አመሰግናለሁ።` | `Read this phrase exactly, including punctuation.` |

7. Confirm exactly four rows exist and record each generated microtask code. Enter
   the phrases as Unicode Amharic in the **Text** field; do not use transliteration.

### 10.6 Add members and pair the facilitator

1. In the task page open **Users** -> **Invite Users**.
2. Select **Invite Reviewers** -> **Add Reviewers to Task**, search for
   `rev@gmail.com`, confirm **Selected Members (1)**, and click **Add Reviewers**.
3. Select **Invite Facilitator** -> **Add Facilitator to Task**, search for
   `faci@gmail.com`, confirm the selected member, and click **Add Facilitator**.
4. Select **Invite Contributor** -> **Add Contributors to Task**, select both
   `cont1@gmail.com` and `cont2@gmail.com`, confirm **Selected Contributors (2)**,
   and click **Add Contributors**.
5. Open the **Facilitator** subtab. On the `faci@gmail.com` row click its plus
   shaped **More options** control.
6. In **Add Contributors to ...**, select both contributors, confirm
   **Selected Contributors (2)**, and click **Add Contributors**.
7. Use the adjacent eye control to verify that both contributors are paired with
   the facilitator. Do not also click automatic contributor distribution.

### 10.7 Distribute microtasks to contributors

1. Open **Task distribution** -> **Contributors**.
2. In **Contributor task distribution**, open **Task Actions**.
3. Click **Start Task Distribution** once.
4. Wait for the request to finish, reload, and inspect Assigned/Not Assigned and
   each contributor's progress.
5. Confirm four microtasks are assigned, two to each contributor. Stop if the
   count is different; inspect members and capacity instead of clicking the
   distribution button repeatedly.

### 10.8 Submit from the Android app

Run the following once for each contributor. The phone widget already supplies
`+251`, so enter only the nine digits.

#### Contributor 1

1. On **Welcome back!**, enter `123456789` in **Phone Number** and the private
   showcase password in **Password**.
2. Tap **Login**, set the app language to English if necessary, then record the
   starting **Your wallet balance**.
3. Tap **Refresh** under **Your Tasks**, select **All** then **New**, and open the
   new `Netcup E2E Amharic TTS Review` task.
4. Confirm **Text to Speech**, the Amharic phrase, task description, and
   instruction. Tap **Start Task**.
5. For the first displayed phrase, tap the microphone button and grant microphone
   permission if prompted. Read the phrase aloud, tap the microphone again to
   stop, and confirm the duration is between 2 and 10 seconds.
6. Tap the play button to listen to the recording. If it is unclear, tap the
   restart button and record again. Tap the check button to save the recording,
   then use the next arrow when the next phrase is shown.
7. Repeat for the second phrase. On the final eligible recording, tapping the
   check button saves it and automatically submits the audio batch. Wait for
   **Task submitted successfully!**
8. Refresh **All**/ **Recent** and confirm the task now shows submissions under
   review. Record both dataset codes if they are displayed.

#### Contributor 2 and the rejection branch

1. Log out from the avatar menu and confirm **Logout**.
2. Log in with phone digits `234567890`, then record the starting wallet balance.
3. Open the same task and record one displayed Amharic phrase exactly.
4. For the other item, deliberately record the spoken phrase `ሰላም።` even if the
   displayed phrase is different. Keep it audible and between 2 and 10 seconds.
   Record which source phrase and microtask code received the incorrect audio.

The incorrect recording is a controlled test defect. Do not use a real person's
data. The check button saves each recording; the final eligible recording starts
the audio upload. A success toast without the PM reload check is not proof of
persistence.

### 10.9 Verify submissions and distribute them to the Reviewer

1. Log back into the web app as `pm@gmail.com`.
2. Open the project -> task -> **Submissions**, reload, and verify four Pending
   audio datasets: contributor, microtask code, Amharic source phrase, audio
   preview, and dataset code.
3. Open **Task distribution** -> **Reviewers**.
4. In **Reviewer task distribution**, open **Task Actions** -> **Distribute Task**.
5. Wait, reload, and confirm all four pending datasets are assigned to
   `rev@gmail.com`. Record the assigned count.

Do not begin review until the PM view proves the submissions are persisted. A
successful mobile toast without this reload check is not an E2E pass.

### 10.10 Approve and reject as Reviewer

1. Log out of the PM session and log in on the web as `rev@gmail.com`.
2. Open **Tasks** -> `/reviewer/tasks`, find the new task, and click **View Details**.
3. Select **Pending** and click **Open Task** in the submission's Action column.
4. Read the Amharic **Question**, play the submitted **Answer** audio, and compare
   the spoken phrase with the displayed text.
5. For each correct initial submission, click **Approve** -> **Approve MicroTask**,
   select `Netcup E2E Correct TTS` under **Annotation**, and click **Submit Approval**.
6. For the recorded incorrect dataset, click **Reject** -> **Reject MicroTask**.
7. Select `Netcup E2E Incorrect TTS` under **Rejection Reasons**, enter
   `Please record the displayed Amharic phrase exactly.` in the optional comment,
   leave **Flag** off, and click **Submit Rejection**.
8. Reload the Reviewer list and verify three Approved and one Rejected initial
   dataset, including the rejection reason and comment. Process only work assigned
   to this Reviewer.

The reviewer approval dialog requires an annotation record, not only an annotation
type. If a decision fails, keep the dialog open, record the response, and do not
advance until the status is confirmed after reload.

### 10.11 Correct the rejected item and approve the retry

1. Log back into the Android app as Contributor 2 using phone digits
   `234567890`.
2. Tap **Refresh** -> **All** or **Recent**, open the card showing the rejected
   work, and tap **View Submissions**, **Continue**, or **Get Started** as displayed.
3. Find the rejected item, record the exact displayed Amharic phrase again, and
   tap the check button to save it. Keep it between 2 and 10 seconds. Do not
   resubmit the already-approved item.
4. As PM, reload **Submissions** and confirm a new Pending attempt exists.
5. As PM, open **Task distribution** -> **Reviewers** -> **Task Actions** ->
   **Distribute Task** again.
6. As Reviewer, play the new audio, confirm it matches the Amharic phrase, and
   approve it with `Netcup E2E Correct TTS`.
7. Reload the Reviewer and PM pages. The original rejected attempt remains in
   history; the latest attempt for that microtask is Approved.

### 10.12 Verify facilitator visibility

1. Log in on the web as `faci@gmail.com` and open **Tasks** -> the new task.
2. Open **Users** and confirm both `cont1@gmail.com` and `cont2@gmail.com` are
   visible under the facilitator's assignment.
3. In each contributor row click **View** under **Submissions**.
4. Verify the status, Amharic microtask phrase, audio playback, approval
   annotation, and (for the rejected history) rejection reason/comment.
5. Use the in-page **Users** and **Tasks** back controls. Facilitators inspect
   submissions here; they do not approve or reject them.

### 10.13 Verify wallet credit (the payment/deposit checkpoint)

There is no manual bank deposit in this showcase. The task payment values are
configured by the PM, and the background dataset consumer deposits in-app wallet
credits after each review decision.

1. Wait for the backend RabbitMQ consumer to finish processing the decisions.
2. Log into the Android app as each contributor and tap wallet **Refresh**. Compare
   the balance with the recorded starting balance.
3. As Reviewer, open `/reviewer` and inspect **Your Wallet Balance**.
4. Open **Transaction History**, select **Credit**, and verify the transaction ID,
   amount, status, and timestamps.
5. Reload both the mobile and Reviewer views. The same dataset must not create a
   second credit after refresh.

For a fresh run with score conversion `1` and payment rate `1`, each contributor
   earns two approved-contribution credits: one for each successful item, with the
   corrected retry replacing the rejected attempt. The Reviewer receives one
   review credit for every decision, including the rejection and the retry. Use
   actual balance deltas rather than assuming an absolute zero balance. If the
   score conversion differs from `1`, multiply by that configured value.

6. As PM, reload **Submissions** and confirm the final four latest outcomes are
   Approved. Only after capturing evidence may you close the task using its
   **Close Task** action.

External withdrawals remain disabled. Do not press a real withdrawal button or use
any phone as a payment destination during the showcase.

## 11. Useful E2E API command patterns

Authenticate without printing the token:

```bash
API=https://mahder-api.duckdns.org/api
TOKEN=$(curl -fsS -X POST "$API/iam/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg username 'admin@gmail.com' --arg password 'PASSWORD_FROM_PRIVATE_FILE' \
    '{username:$username,password:$password}')" | jq -er '.data.access_token')
```

Inspect reference data:

```bash
curl -fsS "$API/setting/language/all" -H "Authorization: Bearer $TOKEN" | jq
curl -fsS "$API/setting/dialect/all" -H "Authorization: Bearer $TOKEN" | jq
curl -fsS "$API/project-mgmt/task-type/all" -H "Authorization: Bearer $TOKEN" | jq
curl -fsS "$API/iam/auth/roles" -H "Authorization: Bearer $TOKEN" | jq
```

Check the showcase task:

```bash
curl -fsS "$API/project-mgmt/task/d93dcf67-1e0c-4f3f-a416-da4396c4f3c6" \
  -H "Authorization: Bearer $TOKEN" | jq
```

For contributor testing, use the contributor mobile token and inspect assigned work:

```bash
curl -fsS "$API/task-distribution/assigned-tasks/d93dcf67-1e0c-4f3f-a416-da4396c4f3c6" \
  -H "Authorization: Bearer $CONTRIBUTOR_TOKEN" | jq
```

## 12. Current disabled integrations

The initial rollout intentionally keeps these disabled or on placeholders:

```text
External withdrawals: disabled
In-app contributor/reviewer credits: enabled after queue processing
Email: placeholder/disabled
SMS: placeholder/disabled
OneSignal push: disabled because production credentials are absent
```

Do not use real payment, SMS, email, or push credentials during the showcase.

## 13. Cleanup after presentation

Do not delete the fixtures until the demonstration is complete. Before cleanup, record any screenshots or results needed for the presentation.

At minimum, remove the sensitive credential files privately:

```bash
rm -f /home/deploy/hyperdata/run/mahder-e2e-credentials.md
rm -f /home/deploy/hyperdata/run/e2e-contributor-password
rm -f /home/deploy/hyperdata/run/admin-initial-password
```

User, project, task, dataset, wallet, and assignment rows have foreign-key relationships. Do not run ad-hoc deletes. Prepare and review one transaction that deletes only the labeled E2E records and temporary users. Never use a broad `DELETE FROM users` or `DROP` command on this shared database.

## 14. Reference-data and redistribution verification

The frontend now sends endpoint-specific reference-data payloads. Verify these
after deployment rather than weakening backend validation:

1. Create and edit a dialect with `name`, optional `description`, and
   `language_id`; reload and confirm the selected language is prepopulated.
2. Create and edit a region with `name`, optional `description`, and
   `country_id`; reload and confirm the selected country is prepopulated.
3. Create and edit a zone with `name` and `region_id`; reload and confirm the
   selected region is prepopulated.
4. Create an annotation with `name`, `description`, and `annotation_type_id`.
   Annotation edits intentionally update only `name` and `description`, matching
   the current update DTO.
5. After redistribution commits, request the contributor detail endpoint again
   and confirm the new assignment appears in `data.contributorMicroTask` without
   manually clearing Redis:

```bash
curl -fsS "$API/task-distribution/assigned-tasks/$TASK_ID" \
  -H "Authorization: Bearer $CONTRIBUTOR_TOKEN" |
  jq '.data.contributorMicroTask | map({id, acceptance_status, can_retry})'
```

The frontend and backend fixes were deployed on 2026-09-24. Compact-screen
verification used `emulator-5554` at 320x640 logical pixels. The rebuilt
home/empty-task view rendered without a RenderFlex overflow, and the 700px
task-layout boundary has automated coverage. The current production Contributor
1 account has no assigned tasks, so recording controls and keyboard-open states
must still be exercised during the fresh four-phrase flow.

## 15. Login redirect fix

On 2026-09-23, valid ProjectManager logins showed a success toast but were redirected back to `/login?callbackUrl=%2Fprojectmanager`. The NextAuth route had a custom `next-auth.session-token` cookie while `withAuth` middleware expected the production default secure cookie name. The custom override was removed and the frontend image was rebuilt.

Verification through the public HTTPS flow:

```text
session role:           ProjectManager
/projectmanager status: 200
redirect:               none
```

After this deployment, clear old browser cookies/site data for `mahder.duckdns.org` once, or use an incognito window, then log in again.
