# Social media manager: one-time setup

Students with the **Media Manager** role write Instagram/Facebook posts and pick a time. A **Coach** approves them, and the server publishes them automatically at that time. This page covers the one-time setup that lets the app post to the team's accounts. It takes about 20 minutes, plus any wait for Meta.

## 1. Instagram and Facebook accounts

1. The team Instagram must be a **Business** or **Creator** account (Instagram → Settings → Account type and tools).
2. Link it to the team **Facebook Page**. In Instagram go to Settings → Accounts Center → Accounts; alternatively, on the Facebook Page go to Settings → Linked accounts → Instagram.
3. The coach who will connect the app must be an **admin of the Facebook Page**.

## 2. Create the Meta app

1. Go to <https://developers.facebook.com/apps> and choose **Create app**.
2. Use case: **Other**, then app type: **Business**. Attach it to the team's Business portfolio if you have one.
3. Add the **Facebook Login for Business** product.
4. Under **Facebook Login for Business → Settings**, add this **Valid OAuth Redirect URI**:
   `https://<your-production-domain>/api/social/meta/callback`
   (The app's Social → Accounts tab shows the exact value.)
5. Under **App roles**, add every coach who will connect accounts as an **Administrator**. Leave the app in **Development** mode.
   - People with a role on the app can grant it every permission it asks for without Meta's App Review. That covers posting to your own team's accounts.
   - Meta may still ask you to finish **Business Verification** before it allows `instagram_content_publish`. If it does, start that early, because it can take a few business days.
6. Copy the **App ID** and **App Secret** (App settings → Basic).

### 2b. Login configuration (System User token)

Under **Facebook Login for Business → Configurations**, create a configuration:
- **Access token:** **System-user access token**, expiring **Never**. The token belongs to the business portfolio instead of one coach, so publishing keeps working if a coach leaves or changes their Facebook password.
- **Assets:** Pages and Instagram accounts, both **required**.
- **Permissions:**
  - `business_management`
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_posts`
  - `instagram_basic`
  - `instagram_content_publish`
  - `instagram_manage_contents` (optional, for future deletes)

  A permission only appears in this list after it's added to one of the app's **Use cases**. The Instagram ones come from **Instagram API → API setup with Facebook login**, and `pages_manage_posts` comes from the Pages use case.

Copy the **Configuration ID** into the `META_LOGIN_CONFIG_ID` secret.

## 3. Replit settings

1. Open the **Object Storage** tool and create a bucket. Uploaded photos and videos live there, because the deployment's disk is wiped on every publish.
2. Add these **Secrets**:

| Secret | Value |
|---|---|
| `META_APP_ID` | the App ID |
| `META_APP_SECRET` | the App Secret |
| `META_TOKEN_KEY` | output of `openssl rand -base64 32` (encrypts the stored Facebook token). **Don't lose or change it**; if you do, reconnect on the Accounts tab. |
| `META_LOGIN_CONFIG_ID` | the **Configuration ID** from Facebook Login for Business → Configurations (see step 2b). Not secret. |
| `APP_BASE_URL` | `https://<your-production-domain>` (no trailing slash). Meta downloads media from here, so it must be the public URL. |

Optional settings:
- `SOCIAL_MEDIA_BUCKET` picks a bucket other than the default.
- `MEDIA_SIGNING_SECRET` signs media links; it falls back to `SESSION_SECRET`.

3. Republish the app.

## 4. Connect and assign

1. As a Coach, open **Social → Accounts → Connect with Facebook**. Sign in and pick the team Page, and make sure you allow every permission it asks for.
2. You should see the Page and the `@instagram` account listed. If Instagram is missing, step 1.2 isn't done; fix it and click **Reconnect**.
3. On the **Team** page, give the students who run social media the **Media Manager** role.

## How it behaves

- **Students** (Media Manager) can write posts, upload photos and videos, and choose a time. They submit posts for review, and can edit or withdraw them until they're published. They see the shared calendar.
  - Editing an approved post takes it off the schedule until a coach approves it again.
- **Coaches** see a Review tab. They can approve a post (keeping or changing the time, or publishing now) or send it back with a comment the student sees. On the calendar they can unschedule a post or retry a failed one.
- **Publishing** happens on the server. Instagram posts are processed by Meta first; video can take a few minutes.
  - If something fails, the student and all coaches get a notification with the reason.
  - If the Facebook connection stops working (password change, removed admin, etc.), coaches are told to reconnect.
- **Limits** enforced in the composer (see `shared/social.ts`):
  - Photos are converted to JPEG and cropped to Instagram's 4:5–1.91:1 range.
  - Videos must be MP4/MOV, up to 300 MB. A single video posts as a Reel on Instagram.
  - Up to 10 items per carousel; carousel videos must be 60 s or shorter.
  - Facebook posts can't mix photos with a video.

## Troubleshooting

- **"needs to be reconnected"**: go to Accounts → Reconnect, then use Retry on the failed post.
- **"Publishing was interrupted"** (Facebook only): the server restarted mid-post. Check the Page before pressing Retry; the post may already be live.
- **Instagram "ERROR" processing a video**: re-export it as H.264 MP4, 30 fps, under 15 minutes, then upload it again.
