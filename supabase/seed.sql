-- ═══════════════════════════════════════════════════════════════════
-- Work Register — seed
--
-- 255 items across 33 sections (201 tasks, 54 to watch).
-- Generated from data/register.seed.ts by scripts/seed-sql.ts. Do not edit
-- this file by hand — edit the seed source and regenerate.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste the whole file → Run.
--   Change the email on the ONE marked line below to the account you sign in
--   with. That is the only edit needed.
--
-- Safe to run as many times as you like. It reconciles rather than replaces:
-- anything you have edited, completed, or added yourself is left alone.
-- ═══════════════════════════════════════════════════════════════════

do $seed$
declare
  -- ↓↓↓ CHANGE THIS to the email you sign in with ↓↓↓
  owner_email text := 'you@example.com';
  -- ↑↑↑ the only line you need to edit ↑↑↑

  owner uuid;
  n_ins int; n_upd int; n_ret int;
begin
  select id into owner from auth.users
   where lower(email) = lower(owner_email) limit 1;

  if owner is null then
    raise exception
      'No account found for %. Invite it under Authentication -> Users, then run this again.',
      owner_email;
  end if;

  insert into public.profiles (id, email, display_name)
  values (owner, owner_email, split_part(owner_email, '@', 1))
  on conflict (id) do nothing;

  -- ── streams ──────────────────────────────────────────────────────
  insert into public.streams (id, owner_id, title, short, code, position) values
    ('cttl', owner, 'Commonwealth Tribute to Life', 'Commonwealth', 'CTtL', 0),
    ('isodp', owner, 'ISODP 2027', 'ISODP 2027', 'ISODP', 1),
    ('dir', owner, 'Directorate', 'Directorate', 'Dir', 2),
    ('career', owner, 'Career', 'Career', 'Career', 3),
    ('per', owner, 'Personal', 'Personal', 'Per', 4)
  on conflict (owner_id, id) do update
     set title = excluded.title, short = excluded.short,
         code = excluded.code, position = excluded.position;

  -- ── sections ─────────────────────────────────────────────────────
  insert into public.sections (id, owner_id, stream_id, title, monitor, position, deleted_at) values
    ('cttl-gov', owner, 'cttl', 'Governance and meetings', false, 0, null),
    ('cttl-fell', owner, 'cttl', 'Fellowship', false, 1, null),
    ('cttl-aus', owner, 'cttl', 'Australia and Sydney', false, 2, null),
    ('cttl-read', owner, 'cttl', 'Reading and development', false, 3, null),
    ('isodp-spons', owner, 'isodp', 'Sponsorship — overall management', false, 4, null),
    ('isodp-organox', owner, 'isodp', 'Sponsorship — OrganOx', false, 5, null),
    ('isodp-china', owner, 'isodp', 'Sponsorship — Chinese and TransNovo', false, 6, null),
    ('isodp-leads', owner, 'isodp', 'Sponsorship — other leads', false, 7, null),
    ('isodp-coll', owner, 'isodp', 'Sponsorship — collateral', false, 8, null),
    ('isodp-pay', owner, 'isodp', 'Finance — sponsor payment process', false, 9, null),
    ('isodp-mystery', owner, 'isodp', 'Finance — the unexplained payment', false, 10, null),
    ('isodp-budget', owner, 'isodp', 'Finance — budget management', false, 11, null),
    ('isodp-abs', owner, 'isodp', 'Programme — abstracts', false, 12, null),
    ('isodp-awards', owner, 'isodp', 'Programme — awards', false, 13, null),
    ('isodp-prog', owner, 'isodp', 'Programme — development', false, 14, null),
    ('isodp-accred', owner, 'isodp', 'Accreditation', false, 15, null),
    ('isodp-web', owner, 'isodp', 'Website', false, 16, null),
    ('isodp-hotels', owner, 'isodp', 'Hotels and accommodation', false, 17, null),
    ('isodp-social', owner, 'isodp', 'Social events and logistics', false, 18, null),
    ('dir-smt', owner, 'dir', 'Senior Management Team', false, 19, null),
    ('dir-crib', owner, 'dir', 'CRIB presentation', false, 20, null),
    ('dir-people', owner, 'dir', 'People compliance', false, 21, null),
    ('dir-steph', owner, 'dir', 'Steph', false, 22, null),
    ('dir-office', owner, 'dir', 'Office', false, 23, null),
    ('dir-restructure', owner, 'dir', 'OTDT and Clinical Services restructure', true, 24, null),
    ('dir-digital', owner, 'dir', 'Digital referral discovery', false, 25, null),
    ('dir-perf', owner, 'dir', 'Donation programme and performance', false, 26, null),
    ('dir-session', owner, 'dir', 'Session design and engagement', false, 27, null),
    ('dir-events', owner, 'dir', 'Events and communications', false, 28, null),
    ('dir-honours', owner, 'dir', 'Honours — Lisa Burnham', false, 29, null),
    ('career-decision', owner, 'career', 'The decision', false, 30, null),
    ('per-grassroot', owner, 'per', 'Grassroot', false, 31, null),
    ('per-property', owner, 'per', 'Property', false, 32, null)
  on conflict (owner_id, id) do update
     set stream_id = excluded.stream_id, title = excluded.title,
         monitor = excluded.monitor, position = excluded.position,
         deleted_at = null;

  -- ── people ───────────────────────────────────────────────────────
  insert into public.people (owner_id, name, role) values
    (owner, 'Anthony', 'Director'),
    (owner, 'Steph', 'Executive Assistant'),
    (owner, 'Dale', null),
    (owner, 'Derek', null),
    (owner, 'Emma', null),
    (owner, 'Suzanne', null),
    (owner, 'Isaac', null),
    (owner, 'Laura', null),
    (owner, 'Lauren', null),
    (owner, 'Belaal', null),
    (owner, 'Satya', null),
    (owner, 'Candy', null),
    (owner, 'Matty', null),
    (owner, 'Jeff', null),
    (owner, 'Rebecca', null),
    (owner, 'Ara', null),
    (owner, 'Kirsty', 'Head of Charity'),
    (owner, 'Peter', null),
    (owner, 'Matt Weis', null),
    (owner, 'Mark Taylor', null),
    (owner, 'John Richardson', null),
    (owner, 'Dr Koval', null),
    (owner, 'Beatrice', null),
    (owner, 'Marty', null),
    (owner, 'Gurch', null),
    (owner, 'Matt', null)
  on conflict (owner_id, name) do update set role = excluded.role;

  -- ── the register itself ──────────────────────────────────────────
  create temp table _seed (
    natural_key text primary key, stream_id text, section_id text,
    title text, kind text, context text, do_now boolean, due date, position int
  ) on commit drop;

  insert into _seed values
    ('cttl-gov:send-formal-invitations-for-the-custodian-board-meeting', 'cttl', 'cttl-gov', 'Send formal invitations for the Custodian Board meeting', 'task', '9 October, 1-2pm. Agenda to follow.', true, null, 0),
    ('cttl-gov:compile-confirmed-custodian-board-member-list', 'cttl', 'cttl-gov', 'Compile confirmed Custodian Board member list', 'task', null, true, null, 1),
    ('cttl-gov:set-up-regional-coordinator-meeting', 'cttl', 'cttl-gov', 'Set up Regional Coordinator meeting', 'task', null, false, null, 2),
    ('cttl-gov:answer-and-follow-up-with-serbian-contacts', 'cttl', 'cttl-gov', 'Answer and follow up with Serbian contacts', 'task', null, false, null, 3),
    ('cttl-gov:locate-and-share-latest-logo-use-and-event-recognition-governance-document', 'cttl', 'cttl-gov', 'Locate and share latest logo use and event recognition governance document', 'task', null, false, null, 4),
    ('cttl-gov:custodian-board-attendance', 'cttl', 'cttl-gov', 'Custodian Board attendance', 'watch', null, false, null, 0),
    ('cttl-gov:regional-coordinator-meeting', 'cttl', 'cttl-gov', 'Regional Coordinator meeting', 'watch', null, false, null, 1),
    ('cttl-fell:update-cttl-website-with-fellowship-information', 'cttl', 'cttl-fell', 'Update CTtL website with Fellowship information', 'task', null, true, null, 0),
    ('cttl-fell:add-placeholder-for-the-fellowship-application-form', 'cttl', 'cttl-fell', 'Add placeholder for the Fellowship application form', 'task', null, true, null, 1),
    ('cttl-fell:formulate-and-circulate-the-fellowship-timeline', 'cttl', 'cttl-fell', 'Formulate and circulate the Fellowship timeline', 'task', 'Advertise by / applications by / interview dates / intended appointment and start', true, null, 2),
    ('cttl-fell:forward-fellowship-document-and-agenda-email-to-dale', 'cttl', 'cttl-fell', 'Forward Fellowship document and agenda email to Dale', 'task', null, false, null, 3),
    ('cttl-fell:send-original-fellowship-submission-document-to-matty', 'cttl', 'cttl-fell', 'Send original Fellowship submission document to Matty', 'task', null, false, null, 4),
    ('cttl-fell:fellowship-timetable', 'cttl', 'cttl-fell', 'Fellowship timetable', 'watch', null, false, null, 0),
    ('cttl-aus:check-with-steph-that-satyas-proposed-flights-can-be-booked-through-nhsbt', 'cttl', 'cttl-aus', 'Check with Steph that Satya''s proposed flights can be booked through NHSBT', 'task', 'Emirates. Birmingham to Sydney outbound 14 September, return 25 September via Singapore to Manchester.', true, null, 0),
    ('cttl-aus:speak-to-steph-first-then-have-steph-contact-satya-directly-about-travel', 'cttl', 'cttl-aus', 'Speak to Steph first, then have Steph contact Satya directly about travel', 'task', null, true, null, 1),
    ('cttl-aus:chase-belaal-for-an-update-on-satyas-australia-trip', 'cttl', 'cttl-aus', 'Chase Belaal for an update on Satya''s Australia trip', 'task', null, true, null, 2),
    ('cttl-aus:escalate-to-anthony-if-belaal-does-not-respond', 'cttl', 'cttl-aus', 'Escalate to Anthony if Belaal does not respond', 'task', null, false, null, 3),
    ('cttl-aus:push-south-australia-tickets-through', 'cttl', 'cttl-aus', 'Push South Australia tickets through', 'task', null, false, null, 4),
    ('cttl-aus:mail-cttl-leaflets-to-dale-ahead-of-the-australia-trip', 'cttl', 'cttl-aus', 'Mail CTtL leaflets to Dale ahead of the Australia trip', 'task', null, false, null, 5),
    ('cttl-aus:find-sydney-event-brochure-and-advertising-material', 'cttl', 'cttl-aus', 'Find Sydney event brochure and advertising material', 'task', null, false, null, 6),
    ('cttl-aus:calculate-exact-number-of-signatory-countries', 'cttl', 'cttl-aus', 'Calculate exact number of signatory countries', 'task', null, false, null, 7),
    ('cttl-aus:calculate-exact-percentage-of-commonwealth-population-covered', 'cttl', 'cttl-aus', 'Calculate exact percentage of Commonwealth population covered', 'task', null, false, null, 8),
    ('cttl-aus:calculate-exact-number-of-organisations-involved-in-cttl', 'cttl', 'cttl-aus', 'Calculate exact number of organisations involved in CTtL', 'task', null, false, null, 9),
    ('cttl-aus:arrange-to-share-satyas-taxi-to-the-hotel-on-wednesday-morning', 'cttl', 'cttl-aus', 'Arrange to share Satya''s taxi to the hotel on Wednesday morning', 'task', null, false, null, 10),
    ('cttl-aus:satya-contract', 'cttl', 'cttl-aus', 'Satya contract', 'watch', null, false, null, 0),
    ('cttl-aus:satya-australia-travel', 'cttl', 'cttl-aus', 'Satya Australia travel', 'watch', null, false, null, 1),
    ('cttl-aus:australia-collateral', 'cttl', 'cttl-aus', 'Australia collateral', 'watch', null, false, null, 2),
    ('cttl-read:read-and-ai-analyse-journey-to-equity-dale-and-gurch-material', 'cttl', 'cttl-read', 'Read and AI-analyse Journey to Equity, Dale and Gurch material', 'task', null, false, null, 0),
    ('cttl-read:review-arc-discovery-slides-and-data', 'cttl', 'cttl-read', 'Review ARC Discovery slides and data', 'task', null, false, null, 1),
    ('cttl-read:pull-out-practical-implications-for-cttl-equity-and-donation-strategy-rather-tha', 'cttl', 'cttl-read', 'Pull out practical implications for CTtL, equity and donation strategy rather than just reading them', 'task', null, false, null, 2),
    ('isodp-spons:send-anthony-the-short-priority-sponsor-list', 'isodp', 'isodp-spons', 'Send Anthony the short priority sponsor list', 'task', 'Quad, MVTA, transplant-related leads, TransMedics', true, null, 0),
    ('isodp-spons:schedule-time-with-anthony-to-go-through-the-sponsor-outreach-spreadsheet', 'isodp', 'isodp-spons', 'Schedule time with Anthony to go through the sponsor outreach spreadsheet', 'task', null, false, null, 1),
    ('isodp-spons:prepare-a-short-chasing-text-anthony-can-use-with-priority-sponsors', 'isodp', 'isodp-spons', 'Prepare a short chasing text Anthony can use with priority sponsors', 'task', null, false, null, 2),
    ('isodp-spons:draft-sponsor-outreach-email-for-anthony-with-the-sponsorship-pack-link', 'isodp', 'isodp-spons', 'Draft sponsor outreach email for Anthony with the sponsorship pack link', 'task', null, false, null, 3),
    ('isodp-spons:produce-and-maintain-the-sponsorship-recap', 'isodp', 'isodp-spons', 'Produce and maintain the sponsorship recap', 'task', null, false, null, 4),
    ('isodp-spons:keep-the-sponsor-pipeline-current', 'isodp', 'isodp-spons', 'Keep the sponsor pipeline current', 'task', null, false, null, 5),
    ('isodp-spons:follow-up-emma-on-her-sponsor-list', 'isodp', 'isodp-spons', 'Follow up Emma on her sponsor list', 'task', null, false, null, 6),
    ('isodp-spons:follow-up-derek-on-his-sponsor-list', 'isodp', 'isodp-spons', 'Follow up Derek on his sponsor list', 'task', null, false, null, 7),
    ('isodp-spons:share-sponsor-list-with-derek', 'isodp', 'isodp-spons', 'Share sponsor list with Derek', 'task', null, false, null, 8),
    ('isodp-spons:follow-up-matt-weis-regarding-sponsor-outreach', 'isodp', 'isodp-spons', 'Follow up Matt Weis regarding sponsor outreach', 'task', null, false, null, 9),
    ('isodp-spons:touch-base-with-jeff-on-board-member-sponsorship-activity', 'isodp', 'isodp-spons', 'Touch base with Jeff on Board member sponsorship activity', 'task', null, false, null, 10),
    ('isodp-spons:continue-seeking-strong-uk-based-sponsors', 'isodp', 'isodp-spons', 'Continue seeking strong UK-based sponsors', 'task', null, false, null, 11),
    ('isodp-spons:jeffs-board-outreach', 'isodp', 'isodp-spons', 'Jeff''s Board outreach', 'watch', null, false, null, 0),
    ('isodp-spons:emmas-outreach', 'isodp', 'isodp-spons', 'Emma''s outreach', 'watch', null, false, null, 1),
    ('isodp-spons:dereks-outreach', 'isodp', 'isodp-spons', 'Derek''s outreach', 'watch', null, false, null, 2),
    ('isodp-spons:matt-weis-outreach', 'isodp', 'isodp-spons', 'Matt Weis outreach', 'watch', null, false, null, 3),
    ('isodp-spons:uk-sponsor-pipeline', 'isodp', 'isodp-spons', 'UK sponsor pipeline', 'watch', null, false, null, 4),
    ('isodp-organox:follow-up-the-organox-uk-marketing-manager', 'isodp', 'isodp-organox', 'Follow up the OrganOx UK marketing manager', 'task', null, false, null, 0),
    ('isodp-organox:set-up-a-call-including-anthony', 'isodp', 'isodp-organox', 'Set up a call including Anthony', 'task', null, false, null, 1),
    ('isodp-organox:speak-to-derek-about-senior-escalation-through-peter', 'isodp', 'isodp-organox', 'Speak to Derek about senior escalation through Peter', 'task', null, false, null, 2),
    ('isodp-organox:provide-derek-with-the-sponsorship-pack', 'isodp', 'isodp-organox', 'Provide Derek with the sponsorship pack', 'task', null, false, null, 3),
    ('isodp-organox:keep-dales-intelligence-on-peters-current-organox-involvement-in-view', 'isodp', 'isodp-organox', 'Keep Dale''s intelligence on Peter''s current OrganOx involvement in view', 'task', null, false, null, 4),
    ('isodp-organox:organox', 'isodp', 'isodp-organox', 'OrganOx', 'watch', null, false, null, 0),
    ('isodp-china:clarify-exactly-what-they-want', 'isodp', 'isodp-china', 'Clarify exactly what they want', 'task', 'Platinum sponsorship, pre-Congress workshop, speaking slot, or a combination', true, null, 0),
    ('isodp-china:clarify-the-actual-sponsoring-entity', 'isodp', 'isodp-china', 'Clarify the actual sponsoring entity', 'task', 'TransNovo, COTDF or another associated company', true, null, 1),
    ('isodp-china:clarify-which-organisation-will-actually-make-payment', 'isodp', 'isodp-china', 'Clarify which organisation will actually make payment', 'task', null, true, null, 2),
    ('isodp-china:keep-the-chinese-contact-warm', 'isodp', 'isodp-china', 'Keep the Chinese contact warm', 'task', null, false, null, 3),
    ('isodp-china:favour-transnovo-as-the-named-sponsor-where-possible', 'isodp', 'isodp-china', 'Favour TransNovo as the named sponsor where possible', 'task', null, false, null, 4),
    ('isodp-china:check-reputational-and-governance-implications', 'isodp', 'isodp-china', 'Check reputational and governance implications', 'task', null, false, null, 5),
    ('isodp-china:check-with-anthony-and-dhsc-if-necessary', 'isodp', 'isodp-china', 'Check with Anthony and DHSC if necessary', 'task', null, false, null, 6),
    ('isodp-china:establish-sensible-cancellation-and-non-refundable-sponsorship-terms', 'isodp', 'isodp-china', 'Establish sensible cancellation and non-refundable sponsorship terms', 'task', null, false, null, 7),
    ('isodp-china:aim-to-collect-major-sponsorship-funds-early', 'isodp', 'isodp-china', 'Aim to collect major sponsorship funds early', 'task', null, false, null, 8),
    ('isodp-china:chinese-and-transnovo', 'isodp', 'isodp-china', 'Chinese and TransNovo', 'watch', null, false, null, 0),
    ('isodp-leads:convert-the-getinge-pencilled-commitment-into-formal-confirmation', 'isodp', 'isodp-leads', 'Convert the Getinge pencilled commitment into formal confirmation', 'task', null, true, null, 0),
    ('isodp-leads:get-european-outreach-underway-before-sydney', 'isodp', 'isodp-leads', 'Get European outreach underway before Sydney', 'task', null, true, null, 1),
    ('isodp-leads:track-getinge-potential-platinum-sponsorship', 'isodp', 'isodp-leads', 'Track Getinge potential platinum sponsorship', 'task', null, false, null, 2),
    ('isodp-leads:pick-up-the-invita-opportunity-with-rebecca', 'isodp', 'isodp-leads', 'Pick up the Invita opportunity with Rebecca', 'task', null, false, null, 3),
    ('isodp-leads:establish-whether-nhsbt-blood-crm-procurement-creates-a-sponsorship-or-conflict-', 'isodp', 'isodp-leads', 'Establish whether NHSBT Blood CRM procurement creates a sponsorship or conflict issue before progressing', 'task', null, false, null, 4),
    ('isodp-leads:track-global-transplant-solutions', 'isodp', 'isodp-leads', 'Track Global Transplant Solutions', 'task', 'Approximately $10k budgeted', false, null, 5),
    ('isodp-leads:track-organ-recovery-systems-follow-up', 'isodp', 'isodp-leads', 'Track Organ Recovery Systems follow-up', 'task', null, false, null, 6),
    ('isodp-leads:track-fusion-fluids', 'isodp', 'isodp-leads', 'Track Fusion Fluids', 'task', null, false, null, 7),
    ('isodp-leads:track-wider-european-and-spanish-prospects', 'isodp', 'isodp-leads', 'Track wider European and Spanish prospects', 'task', null, false, null, 8),
    ('isodp-leads:brief-dale-on-beatrice-and-marty-sponsor-conversations-in-sydney', 'isodp', 'isodp-leads', 'Brief Dale on Beatrice and Marty sponsor conversations in Sydney', 'task', null, false, null, 9),
    ('isodp-leads:review-aras-sponsorship-proposal-and-take-it-to-loc', 'isodp', 'isodp-leads', 'Review Ara''s sponsorship proposal and take it to LOC', 'task', null, false, null, 10),
    ('isodp-leads:put-together-the-ba-sponsorship-proposal-against-ba-criteria', 'isodp', 'isodp-leads', 'Put together the BA sponsorship proposal against BA criteria', 'task', null, false, null, 11),
    ('isodp-leads:ask-kirsty-head-of-charity-to-support-the-ba-sponsorship-application', 'isodp', 'isodp-leads', 'Ask Kirsty, Head of Charity, to support the BA sponsorship application', 'task', null, false, null, 12),
    ('isodp-leads:getinge', 'isodp', 'isodp-leads', 'Getinge', 'watch', null, false, null, 0),
    ('isodp-leads:invita', 'isodp', 'isodp-leads', 'Invita', 'watch', null, false, null, 1),
    ('isodp-leads:global-transplant-solutions', 'isodp', 'isodp-leads', 'Global Transplant Solutions', 'watch', null, false, null, 2),
    ('isodp-leads:organ-recovery-systems', 'isodp', 'isodp-leads', 'Organ Recovery Systems', 'watch', null, false, null, 3),
    ('isodp-leads:fusion-fluids', 'isodp', 'isodp-leads', 'Fusion Fluids', 'watch', null, false, null, 4),
    ('isodp-leads:ba-sponsorship', 'isodp', 'isodp-leads', 'BA sponsorship', 'watch', null, false, null, 5),
    ('isodp-leads:european-and-spanish-pipeline', 'isodp', 'isodp-leads', 'European and Spanish pipeline', 'watch', null, false, null, 6),
    ('isodp-coll:ensure-emma-has-the-final-sponsorship-brochure', 'isodp', 'isodp-coll', 'Ensure Emma has the final sponsorship brochure', 'task', null, false, null, 0),
    ('isodp-coll:ensure-emma-has-sponsor-contacts-assigned-to-her', 'isodp', 'isodp-coll', 'Ensure Emma has sponsor contacts assigned to her', 'task', null, false, null, 1),
    ('isodp-coll:ensure-emma-has-sponsorship-document-access', 'isodp', 'isodp-coll', 'Ensure Emma has sponsorship document access', 'task', null, false, null, 2),
    ('isodp-coll:send-emma-an-introductory-email-explaining-isodp', 'isodp', 'isodp-coll', 'Send Emma an introductory email explaining ISODP', 'task', null, false, null, 3),
    ('isodp-coll:speak-to-lauren-about-reflecting-confirmed-sponsors-in-the-brochure', 'isodp', 'isodp-coll', 'Speak to Lauren about reflecting confirmed sponsors in the brochure', 'task', null, false, null, 4),
    ('isodp-coll:update-the-sponsorship-brochure-as-sponsors-confirm', 'isodp', 'isodp-coll', 'Update the sponsorship brochure as sponsors confirm', 'task', null, false, null, 5),
    ('isodp-coll:send-the-final-brochure-to-congress-board', 'isodp', 'isodp-coll', 'Send the final brochure to Congress Board', 'task', null, false, null, 6),
    ('isodp-coll:summarise-the-sponsorship-discussion-by-email-when-useful', 'isodp', 'isodp-coll', 'Summarise the sponsorship discussion by email when useful', 'task', null, false, null, 7),
    ('isodp-coll:send-the-congress-graphic-and-video-file-to-lauren-for-the-website', 'isodp', 'isodp-coll', 'Send the congress graphic and video file to Lauren for the website', 'task', null, false, null, 8),
    ('isodp-pay:clarify-the-end-to-end-process-for-sponsors-paying-nhsbt', 'isodp', 'isodp-pay', 'Clarify the end-to-end process for sponsors paying NHSBT', 'task', null, true, null, 0),
    ('isodp-pay:draft-escalation-email-for-anthony-to-send-to-mark-taylor', 'isodp', 'isodp-pay', 'Draft escalation email for Anthony to send to Mark Taylor', 'task', 'Make clear sponsors are ready to pay but currently lack a workable payment route.', true, null, 1),
    ('isodp-pay:set-up-a-daytime-call-with-anthony-isaac-and-john-richardson', 'isodp', 'isodp-pay', 'Set up a daytime call with Anthony, Isaac and John Richardson', 'task', null, true, null, 2),
    ('isodp-pay:ask-isaac-who-the-correct-named-finance-contact-is', 'isodp', 'isodp-pay', 'Ask Isaac who the correct named finance contact is', 'task', null, false, null, 3),
    ('isodp-pay:set-up-a-three-way-call-with-isaac-and-that-person-if-needed', 'isodp', 'isodp-pay', 'Set up a three-way call with Isaac and that person if needed', 'task', null, false, null, 4),
    ('isodp-pay:clarify-invoicing-bank-details-and-international-transfers', 'isodp', 'isodp-pay', 'Clarify invoicing, bank details and international transfers', 'task', null, false, null, 5),
    ('isodp-pay:clarify-payment-references-vat-and-exchange-rate-handling', 'isodp', 'isodp-pay', 'Clarify payment references, VAT and exchange-rate handling', 'task', null, false, null, 6),
    ('isodp-pay:clarify-fees-deductions-refunds-and-cancellation', 'isodp', 'isodp-pay', 'Clarify fees, deductions, refunds and cancellation', 'task', null, false, null, 7),
    ('isodp-pay:ask-finance-and-accounts-about-vat-treatment-on-sponsorship', 'isodp', 'isodp-pay', 'Ask Finance and Accounts about VAT treatment on sponsorship', 'task', null, false, null, 8),
    ('isodp-pay:check-with-the-finance-committee-whether-a-stripe-portal-or-similar-invoicing-so', 'isodp', 'isodp-pay', 'Check with the Finance Committee whether a Stripe portal or similar invoicing solution is possible', 'task', null, false, null, 9),
    ('isodp-pay:call-suzanne-about-receiving-payments-in-usd-versus-gbp-and-exchange-rate-handli', 'isodp', 'isodp-pay', 'Call Suzanne about receiving payments in USD versus GBP and exchange-rate handling', 'task', null, false, null, 10),
    ('isodp-pay:ask-suzanne-how-currency-and-international-payments-were-handled-at-previous-con', 'isodp', 'isodp-pay', 'Ask Suzanne how currency and international payments were handled at previous Congresses', 'task', null, false, null, 11),
    ('isodp-pay:confirm-with-oxford-abstracts-how-they-handle-multi-currency-payments', 'isodp', 'isodp-pay', 'Confirm with Oxford Abstracts how they handle multi-currency payments', 'task', null, false, null, 12),
    ('isodp-pay:re-run-registration-cost-numbers-with-isaac', 'isodp', 'isodp-pay', 'Re-run registration cost numbers with Isaac', 'task', null, false, null, 13),
    ('isodp-pay:dig-into-the-old-budget-sheet-and-confirm-speaker-policy', 'isodp', 'isodp-pay', 'Dig into the old budget sheet and confirm speaker policy', 'task', 'Flights, accommodation, registration', false, null, 14),
    ('isodp-pay:sponsor-payment-mechanism', 'isodp', 'isodp-pay', 'Sponsor payment mechanism', 'watch', null, false, null, 0),
    ('isodp-pay:vat-treatment', 'isodp', 'isodp-pay', 'VAT treatment', 'watch', null, false, null, 1),
    ('isodp-pay:international-currency-process', 'isodp', 'isodp-pay', 'International currency process', 'watch', null, false, null, 2),
    ('isodp-pay:stripe-or-invoicing-solution', 'isodp', 'isodp-pay', 'Stripe or invoicing solution', 'watch', null, false, null, 3),
    ('isodp-pay:registration-cost-modelling', 'isodp', 'isodp-pay', 'Registration cost modelling', 'watch', null, false, null, 4),
    ('isodp-mystery:investigate-the-unexplained-1-085-payment', 'isodp', 'isodp-mystery', 'Investigate the unexplained €1,085 payment', 'task', 'Approximately £910', false, null, 0),
    ('isodp-mystery:identify-the-sender', 'isodp', 'isodp-mystery', 'Identify the sender', 'task', null, false, null, 1),
    ('isodp-mystery:establish-why-it-was-paid', 'isodp', 'isodp-mystery', 'Establish why it was paid', 'task', null, false, null, 2),
    ('isodp-mystery:establish-how-the-sender-obtained-isodp-payment-details', 'isodp', 'isodp-mystery', 'Establish how the sender obtained ISODP payment details', 'task', null, false, null, 3),
    ('isodp-mystery:confirm-the-correct-accounting-treatment', 'isodp', 'isodp-mystery', 'Confirm the correct accounting treatment', 'task', null, false, null, 4),
    ('isodp-mystery:check-with-suzanne-and-tts-whether-it-originated-through-them', 'isodp', 'isodp-mystery', 'Check with Suzanne and TTS whether it originated through them', 'task', null, false, null, 5),
    ('isodp-mystery:mystery-910-payment', 'isodp', 'isodp-mystery', 'Mystery £910 payment', 'watch', null, false, null, 0),
    ('isodp-budget:add-a-forecast-of-major-expenditure-to-the-budget-tracker', 'isodp', 'isodp-budget', 'Add a forecast of major expenditure to the budget tracker', 'task', null, false, null, 0),
    ('isodp-budget:upload-the-budget-tracking-document-to-sharepoint', 'isodp', 'isodp-budget', 'Upload the budget tracking document to SharePoint', 'task', null, false, null, 1),
    ('isodp-abs:find-the-number-of-accepted-oral-abstracts-at-kyoto', 'isodp', 'isodp-abs', 'Find the number of accepted oral abstracts at Kyoto', 'task', null, false, null, 0),
    ('isodp-abs:speak-to-suzanne-about-abstract-categories-awards-and-submission-rules', 'isodp', 'isodp-abs', 'Speak to Suzanne about abstract categories, awards and submission rules', 'task', null, false, null, 1),
    ('isodp-abs:chase-matt-and-dale-for-final-abstract-categories-and-awards-information', 'isodp', 'isodp-abs', 'Chase Matt and Dale for final abstract categories and awards information', 'task', null, false, null, 2),
    ('isodp-abs:tell-candy-and-the-oxford-team-they-can-build-around-the-working-13-categories', 'isodp', 'isodp-abs', 'Tell Candy and the Oxford team they can build around the working 13 categories', 'task', null, false, null, 3),
    ('isodp-abs:update-the-system-if-the-final-spc-decision-changes-the-categories', 'isodp', 'isodp-abs', 'Update the system if the final SPC decision changes the categories', 'task', null, false, null, 4),
    ('isodp-abs:track-spc-decisions-on-invited-speakers-oral-abstracts-mini-abstracts-and-abstra', 'isodp', 'isodp-abs', 'Track SPC decisions on invited speakers, oral abstracts, mini abstracts and abstract-only sessions', 'task', null, false, null, 5),
    ('isodp-abs:final-abstract-categories', 'isodp', 'isodp-abs', 'Final abstract categories', 'watch', null, false, null, 0),
    ('isodp-abs:spc-parallel-session-structure', 'isodp', 'isodp-abs', 'SPC parallel-session structure', 'watch', null, false, null, 1),
    ('isodp-awards:get-existing-award-details-from-suzanne', 'isodp', 'isodp-awards', 'Get existing award details from Suzanne', 'task', null, false, null, 0),
    ('isodp-awards:feed-award-details-into-the-oxford-and-website-build', 'isodp', 'isodp-awards', 'Feed award details into the Oxford and website build', 'task', null, false, null, 1),
    ('isodp-awards:track-executive-council-decisions-on-top-abstract-and-poster-awards', 'isodp', 'isodp-awards', 'Track Executive Council decisions on top abstract and poster awards', 'task', null, false, null, 2),
    ('isodp-awards:track-decisions-on-travel-scholarships-and-speaker-support', 'isodp', 'isodp-awards', 'Track decisions on travel scholarships and speaker support', 'task', null, false, null, 3),
    ('isodp-awards:track-decisions-on-young-investigator-and-emerging-economy-awards', 'isodp', 'isodp-awards', 'Track decisions on young investigator and emerging economy awards', 'task', null, false, null, 4),
    ('isodp-awards:incorporate-final-decisions-into-website-abstract-platform-communications-and-bu', 'isodp', 'isodp-awards', 'Incorporate final decisions into website, abstract platform, communications and budget', 'task', null, false, null, 5),
    ('isodp-awards:awards-decision', 'isodp', 'isodp-awards', 'Awards decision', 'watch', null, false, null, 0),
    ('isodp-prog:keep-dr-koval-and-ukraine-plenary-participation-on-the-radar', 'isodp', 'isodp-prog', 'Keep Dr Koval and Ukraine plenary participation on the radar', 'task', null, false, null, 0),
    ('isodp-prog:ensure-programme-information-needed-for-website-and-accreditation-is-captured-as', 'isodp', 'isodp-prog', 'Ensure programme information needed for website and accreditation is captured as it firms up', 'task', null, false, null, 1),
    ('isodp-prog:dr-koval', 'isodp', 'isodp-prog', 'Dr Koval', 'watch', null, false, null, 0),
    ('isodp-accred:have-dale-speak-to-sylvia-paris-regarding-cme-and-accreditation-needs', 'isodp', 'isodp-accred', 'Have Dale speak to Sylvia Paris regarding CME and accreditation needs', 'task', null, false, null, 0),
    ('isodp-accred:clarify-whether-college-of-intensive-care-medicine-accreditation-is-sufficient', 'isodp', 'isodp-accred', 'Clarify whether College of Intensive Care Medicine accreditation is sufficient', 'task', null, false, null, 1),
    ('isodp-accred:determine-whether-abtc-or-non-physician-accreditation-is-worthwhile', 'isodp', 'isodp-accred', 'Determine whether ABTC or non-physician accreditation is worthwhile', 'task', null, false, null, 2),
    ('isodp-accred:have-anthony-pursue-uk-accreditation-once-programme-and-speakers-are-sufficientl', 'isodp', 'isodp-accred', 'Have Anthony pursue UK accreditation once programme and speakers are sufficiently developed', 'task', 'Keep moving through Dale.', false, null, 3),
    ('isodp-accred:cme-and-abtc-accreditation', 'isodp', 'isodp-accred', 'CME and ABTC accreditation', 'watch', null, false, null, 0),
    ('isodp-web:review-lauren-and-candys-initial-website-build', 'isodp', 'isodp-web', 'Review Lauren and Candy''s initial website build', 'task', null, false, null, 0),
    ('isodp-web:respond-with-consolidated-feedback', 'isodp', 'isodp-web', 'Respond with consolidated feedback', 'task', null, false, null, 1),
    ('isodp-web:ensure-development-proceeds-towards-isodp2027-com', 'isodp', 'isodp-web', 'Ensure development proceeds towards isodp2027.com', 'task', null, false, null, 2),
    ('isodp-web:improve-navigation-compared-with-kyoto', 'isodp', 'isodp-web', 'Improve navigation compared with Kyoto', 'task', null, false, null, 3),
    ('isodp-web:make-sure-important-information-does-not-sit-buried-on-long-pages', 'isodp', 'isodp-web', 'Make sure important information does not sit buried on long pages', 'task', null, false, null, 4),
    ('isodp-web:ensure-clear-sections-for-registration-abstracts-programme-and-awards', 'isodp', 'isodp-web', 'Ensure clear sections for registration, abstracts, programme and awards', 'task', null, false, null, 5),
    ('isodp-web:ensure-clear-sections-for-accommodation-sponsorship-and-venue', 'isodp', 'isodp-web', 'Ensure clear sections for accommodation, sponsorship and venue', 'task', null, false, null, 6),
    ('isodp-web:review-ipda-and-other-tts-congress-sites-as-reference-models', 'isodp', 'isodp-web', 'Review IPDA and other TTS Congress sites as reference models', 'task', null, false, null, 7),
    ('isodp-web:ensure-the-latest-sponsorship-brochure-and-confirmed-sponsors-are-reflected', 'isodp', 'isodp-web', 'Ensure the latest sponsorship brochure and confirmed sponsors are reflected', 'task', null, false, null, 8),
    ('isodp-web:ensure-the-congress-graphic-and-video-is-incorporated', 'isodp', 'isodp-web', 'Ensure the congress graphic and video is incorporated', 'task', null, false, null, 9),
    ('isodp-web:website-progress', 'isodp', 'isodp-web', 'Website progress', 'watch', null, false, null, 0),
    ('isodp-hotels:start-accommodation-work-now', 'isodp', 'isodp-hotels', 'Start accommodation work now', 'task', null, true, null, 0),
    ('isodp-hotels:contact-the-qeii-centre-about-preferred-hotel-relationships-and-rates', 'isodp', 'isodp-hotels', 'Contact the QEII Centre about preferred hotel relationships and rates', 'task', null, false, null, 1),
    ('isodp-hotels:investigate-hotelmap', 'isodp', 'isodp-hotels', 'Investigate HotelMap', 'task', null, false, null, 2),
    ('isodp-hotels:determine-whether-hotelmap-can-be-embedded-or-linked-cleanly-from-the-website', 'isodp', 'isodp-hotels', 'Determine whether HotelMap can be embedded or linked cleanly from the website', 'task', null, false, null, 3),
    ('isodp-hotels:identify-preferred-hotels-close-to-qeii', 'isodp', 'isodp-hotels', 'Identify preferred hotels close to QEII', 'task', null, false, null, 4),
    ('isodp-hotels:identify-a-potential-headquarters-hotel', 'isodp', 'isodp-hotels', 'Identify a potential headquarters hotel', 'task', null, false, null, 5),
    ('isodp-hotels:consider-a-hotel-suitable-for-executive-and-council-speakers-and-organising-team', 'isodp', 'isodp-hotels', 'Consider a hotel suitable for Executive and Council, speakers and organising team', 'task', null, false, null, 6),
    ('isodp-hotels:explore-group-and-room-block-booking', 'isodp', 'isodp-hotels', 'Explore group and room-block booking', 'task', null, false, null, 7),
    ('isodp-hotels:determine-how-speaker-accommodation-should-be-managed', 'isodp', 'isodp-hotels', 'Determine how speaker accommodation should be managed', 'task', null, false, null, 8),
    ('isodp-hotels:bring-actual-hotel-options-and-indicative-rates-to-loc-rather-than-only-discussi', 'isodp', 'isodp-hotels', 'Bring actual hotel options and indicative rates to LOC rather than only discussing the concept', 'task', null, false, null, 9),
    ('isodp-hotels:hotelmap', 'isodp', 'isodp-hotels', 'HotelMap', 'watch', null, false, null, 0),
    ('isodp-hotels:headquarters-hotel', 'isodp', 'isodp-hotels', 'Headquarters hotel', 'watch', null, false, null, 1),
    ('isodp-hotels:room-block', 'isodp', 'isodp-hotels', 'Room block', 'watch', null, false, null, 2),
    ('isodp-social:develop-007-gala-dinner-ideas-in-the-shared-loc-folder', 'isodp', 'isodp-social', 'Develop 007 gala dinner ideas in the shared LOC folder', 'task', null, false, null, 0),
    ('isodp-social:follow-up-houses-of-parliament-dinner-possibilities', 'isodp', 'isodp-social', 'Follow up Houses of Parliament dinner possibilities', 'task', 'Capacity, regulations, costs, practical feasibility', false, null, 1),
    ('isodp-social:contact-the-aquarium-venue-about-the-presidents-dinner', 'isodp', 'isodp-social', 'Contact the aquarium venue about the President''s Dinner', 'task', null, false, null, 2),
    ('isodp-social:contact-oxo-tower-about-the-presidents-dinner', 'isodp', 'isodp-social', 'Contact OXO Tower about the President''s Dinner', 'task', null, false, null, 3),
    ('isodp-social:review-loc-meeting-notes-and-provide-feedback', 'isodp', 'isodp-social', 'Review LOC meeting notes and provide feedback', 'task', null, false, null, 4),
    ('isodp-social:presidents-dinner', 'isodp', 'isodp-social', 'President''s Dinner', 'watch', null, false, null, 0),
    ('isodp-social:gala-dinner', 'isodp', 'isodp-social', 'Gala Dinner', 'watch', null, false, null, 1),
    ('dir-smt:do-the-smt-summary', 'dir', 'dir-smt', 'Do the SMT summary', 'task', null, false, null, 0),
    ('dir-smt:arrange-follow-up-discussion-about-restructuring-the-smt-agenda-format', 'dir', 'dir-smt', 'Arrange follow-up discussion about restructuring the SMT agenda format', 'task', null, false, null, 1),
    ('dir-smt:develop-a-more-useful-future-smt-agenda-structure', 'dir', 'dir-smt', 'Develop a more useful future SMT agenda structure', 'task', null, false, null, 2),
    ('dir-crib:schedule-follow-up-with-mike-on-crib', 'dir', 'dir-crib', 'Schedule follow-up with Mike on CRIB', 'task', null, false, null, 0),
    ('dir-crib:update-and-consolidate-the-presentation-following-mikes-walkthrough', 'dir', 'dir-crib', 'Update and consolidate the presentation following Mike''s walkthrough', 'task', null, false, null, 1),
    ('dir-crib:combine-and-streamline-the-slides', 'dir', 'dir-crib', 'Combine and streamline the slides', 'task', 'Programme overview, consent rate, family approach, marketing strategy, corneas', false, null, 2),
    ('dir-crib:add-clearer-labels-where-needed', 'dir', 'dir-crib', 'Add clearer labels where needed', 'task', null, false, null, 3),
    ('dir-crib:move-narrative-text-into-speaker-notes-so-it-is-not-visible-to-the-audience', 'dir', 'dir-crib', 'Move narrative text into speaker notes so it is not visible to the audience', 'task', null, false, null, 4),
    ('dir-people:draft-and-send-the-pdpr-compliance-email-to-non-compliant-staff', 'dir', 'dir-people', 'Draft and send the PDPR compliance email to non-compliant staff', 'task', 'Make clear that managers are responsible for arranging PDPRs.', true, null, 0),
    ('dir-people:review-anthonys-previous-conflicts-of-interest-email', 'dir', 'dir-people', 'Review Anthony''s previous Conflicts of Interest email', 'task', null, true, null, 1),
    ('dir-people:check-outstanding-conflicts-of-interest-declarations', 'dir', 'dir-people', 'Check outstanding Conflicts of Interest declarations', 'task', null, false, null, 2),
    ('dir-people:chase-remaining-individuals-directly-where-necessary', 'dir', 'dir-people', 'Chase remaining individuals directly where necessary', 'task', null, false, null, 3),
    ('dir-people:pdpr-rate', 'dir', 'dir-people', 'PDPR rate', 'watch', null, false, null, 0),
    ('dir-people:conflict-of-interest-compliance', 'dir', 'dir-people', 'Conflict of Interest compliance', 'watch', null, false, null, 1),
    ('dir-steph:finalise-stephs-pdpr', 'dir', 'dir-steph', 'Finalise Steph''s PDPR', 'task', null, false, null, 0),
    ('dir-steph:try-to-arrange-stephs-blood-donation-visit', 'dir', 'dir-steph', 'Try to arrange Steph''s Blood Donation visit', 'task', null, false, null, 1),
    ('dir-office:ask-the-heads-of-office-group-for-a-workaround-to-the-team-talk-recording-access', 'dir', 'dir-office', 'Ask the Heads of Office group for a workaround to the Team Talk recording-access issue', 'task', null, false, null, 0),
    ('dir-office:sort-satyas-honorary-contract', 'dir', 'dir-office', 'Sort Satya''s honorary contract', 'task', null, false, null, 1),
    ('dir-office:chase-satyas-contract-through-an-alternative-route-if-stalled', 'dir', 'dir-office', 'Chase Satya''s contract through an alternative route if stalled', 'task', null, false, null, 2),
    ('dir-restructure:communications-timeline-for-clinical-services-changes', 'dir', 'dir-restructure', 'Communications timeline for Clinical Services changes', 'watch', null, false, null, 0),
    ('dir-restructure:september-announcement', 'dir', 'dir-restructure', 'September announcement', 'watch', null, false, null, 1),
    ('dir-restructure:anthony-and-bilal-discussion-on-interim-versus-substantive-director', 'dir', 'dir-restructure', 'Anthony and Bilal discussion on interim versus substantive Director', 'watch', null, false, null, 2),
    ('dir-restructure:likely-interim-director-of-otdt-solution', 'dir', 'dir-restructure', 'Likely interim Director of OTDT solution', 'watch', null, false, null, 3),
    ('dir-restructure:consequent-ad-backfill-requirements', 'dir', 'dir-restructure', 'Consequent AD backfill requirements', 'watch', null, false, null, 4),
    ('dir-restructure:emerging-reporting-lines-across-otdt-clinical-services-chief-nurse-transformatio', 'dir', 'dir-restructure', 'Emerging reporting lines across OTDT, Clinical Services, Chief Nurse, Transformation and Digital', 'watch', null, false, null, 5),
    ('dir-restructure:deloitte-operating-model-work', 'dir', 'dir-restructure', 'Deloitte operating-model work', 'watch', null, false, null, 6),
    ('dir-restructure:communications-and-staff-engagement-risks', 'dir', 'dir-restructure', 'Communications and staff engagement risks', 'watch', null, false, null, 7),
    ('dir-restructure:anthonys-own-position-and-appetite-for-the-future-role', 'dir', 'dir-restructure', 'Anthony''s own position and appetite for the future role', 'watch', null, false, null, 8),
    ('dir-digital:speak-to-anthony-about-splitting-your-time-so-you-can-begin-working-with-laura', 'dir', 'dir-digital', 'Speak to Anthony about splitting your time so you can begin working with Laura', 'task', null, true, null, 0),
    ('dir-digital:start-involvement-in-digital-referral-discovery', 'dir', 'dir-digital', 'Start involvement in digital referral discovery', 'task', null, false, null, 1),
    ('dir-digital:find-the-texas-digital-referral-case-study-paper', 'dir', 'dir-digital', 'Find the Texas digital referral case study paper', 'task', null, false, null, 2),
    ('dir-digital:send-the-texas-paper-to-laura', 'dir', 'dir-digital', 'Send the Texas paper to Laura', 'task', null, false, null, 3),
    ('dir-digital:connect-arc-discovery-findings-with-referral-pathways-equity-digital-opportuniti', 'dir', 'dir-digital', 'Connect ARC Discovery findings with referral pathways, equity, digital opportunities and operational feasibility', 'task', null, false, null, 4),
    ('dir-digital:digital-referral-discovery', 'dir', 'dir-digital', 'Digital referral discovery', 'watch', null, false, null, 0),
    ('dir-perf:speak-to-anthony-about-whether-the-organ-donation-session-should-be-postponed-un', 'dir', 'dir-perf', 'Speak to Anthony about whether the organ donation session should be postponed until better prepared', 'task', null, false, null, 0),
    ('dir-perf:review-the-organ-donation-week-script', 'dir', 'dir-perf', 'Review the Organ Donation Week script', 'task', null, false, null, 1),
    ('dir-perf:review-the-organ-donation-week-slides', 'dir', 'dir-perf', 'Review the Organ Donation Week slides', 'task', null, false, null, 2),
    ('dir-perf:confirm-organ-donation-week-content-is-ready-and-appropriate', 'dir', 'dir-perf', 'Confirm Organ Donation Week content is ready and appropriate', 'task', null, false, null, 3),
    ('dir-perf:double-check-whether-kanak-needs-anything-else-ahead-of-the-accenture-workshop', 'dir', 'dir-perf', 'Double-check whether Kanak needs anything else ahead of the Accenture workshop', 'task', null, false, null, 4),
    ('dir-perf:respond-to-kanaks-workshop-email-with-the-right-contacts', 'dir', 'dir-perf', 'Respond to Kanak''s workshop email with the right contacts', 'task', 'Alex Hudson for registration, Laura for matching and allocation, plus the relevant process-improvement contact', false, null, 5),
    ('dir-perf:current-donation-performance-pressures-when-planning-transformation-activity', 'dir', 'dir-perf', 'Current donation performance pressures when planning transformation activity', 'watch', null, false, null, 0),
    ('dir-perf:donation-performance', 'dir', 'dir-perf', 'Donation performance', 'watch', null, false, null, 1),
    ('dir-session:test-mentimeter', 'dir', 'dir-session', 'Test Mentimeter', 'task', null, false, null, 0),
    ('dir-session:confirm-mentimeter-works-as-expected', 'dir', 'dir-session', 'Confirm Mentimeter works as expected', 'task', null, false, null, 1),
    ('dir-session:consider-menti-or-an-equivalent-interactive-platform-for-the-sdg-session', 'dir', 'dir-session', 'Consider Menti or an equivalent interactive platform for the SDG session', 'task', null, false, null, 2),
    ('dir-session:think-through-what-the-sdg-session-should-look-like', 'dir', 'dir-session', 'Think through what the SDG session should look like', 'task', null, false, null, 3),
    ('dir-session:send-sdg-session-ideas-ahead-of-the-follow-up-call', 'dir', 'dir-session', 'Send SDG session ideas ahead of the follow-up call', 'task', null, false, null, 4),
    ('dir-session:think-through-which-leadership-capabilities-should-underpin-session-design', 'dir', 'dir-session', 'Think through which leadership capabilities should underpin session design', 'task', null, false, null, 5),
    ('dir-session:find-and-share-notes-containing-anthonys-brainstorming-ideas', 'dir', 'dir-session', 'Find and share notes containing Anthony''s brainstorming ideas', 'task', null, false, null, 6),
    ('dir-session:reach-out-to-kate-or-mark-taylors-team-if-required-regarding-sdg-planning', 'dir', 'dir-session', 'Reach out to Kate or Mark Taylor''s team if required regarding SDG planning', 'task', null, false, null, 7),
    ('dir-events:contact-the-nhsbt-filming-and-recording-team-to-pencil-them-in-for-the-donor-rec', 'dir', 'dir-events', 'Contact the NHSBT filming and recording team to pencil them in for the donor recognition event', 'task', null, false, null, 0),
    ('dir-events:prepare-anthonys-speaking-notes-for-the-partner-and-stakeholder-webinar', 'dir', 'dir-events', 'Prepare Anthony''s speaking notes for the partner and stakeholder webinar', 'task', null, false, null, 1),
    ('dir-events:set-up-a-teams-channel-for-the-relevant-three-participants', 'dir', 'dir-events', 'Set up a Teams channel for the relevant three participants', 'task', null, false, null, 2),
    ('dir-events:send-a-joint-email-to-presenters-who-still-owe-presentations', 'dir', 'dir-events', 'Send a joint email to presenters who still owe presentations', 'task', null, false, null, 3),
    ('dir-events:reach-out-to-the-digital-team-for-a-teams-link-for-the-international-session', 'dir', 'dir-events', 'Reach out to the digital team for a Teams link for the international session', 'task', null, false, null, 4),
    ('dir-events:pass-the-teams-link-to-the-relevant-organiser', 'dir', 'dir-events', 'Pass the Teams link to the relevant organiser', 'task', null, false, null, 5),
    ('dir-honours:draft-the-honours-nomination-for-lisa-burnham', 'dir', 'dir-honours', 'Draft the honours nomination for Lisa Burnham', 'task', null, true, null, 0),
    ('dir-honours:pull-together-supporting-evidence-for-the-nomination', 'dir', 'dir-honours', 'Pull together supporting evidence for the nomination', 'task', null, true, null, 1),
    ('dir-honours:confirm-the-evidence-is-accurate', 'dir', 'dir-honours', 'Confirm the evidence is accurate', 'task', 'Career impact, international work, committee roles, charity involvement, living kidney donation history', false, null, 2),
    ('dir-honours:speak-to-derek-for-evidence-and-context', 'dir', 'dir-honours', 'Speak to Derek for evidence and context', 'task', null, false, null, 3),
    ('dir-honours:identify-supporting-letter-writers', 'dir', 'dir-honours', 'Identify supporting letter writers', 'task', null, false, null, 4),
    ('dir-honours:obtain-supporting-letters', 'dir', 'dir-honours', 'Obtain supporting letters', 'task', 'Anthony, Derek, the relevant charity, an external or international partner', false, null, 5),
    ('dir-honours:submit-the-nomination-internally-to-kate-thomas-and-wayne-norleigh', 'dir', 'dir-honours', 'Submit the nomination internally to Kate Thomas and Wayne Norleigh', 'task', null, true, '2026-08-28', 6),
    ('career-decision:apply-for-the-head-of-organ-donation-partnerships-role-when-it-opens', 'career', 'career-decision', 'Apply for the Head of Organ Donation Partnerships role when it opens', 'task', null, false, null, 0),
    ('career-decision:keep-both-that-and-the-product-opportunity-alive-until-you-have-a-genuine-choice', 'career', 'career-decision', 'Keep both that and the Product opportunity alive until you have a genuine choice', 'task', null, false, null, 1),
    ('career-decision:decide-between-the-product-role-and-the-partnerships-secondment', 'career', 'career-decision', 'Decide between the Product role and the Partnerships secondment', 'task', null, false, null, 2),
    ('career-decision:speak-to-the-relevant-people-once-the-decision-point-arrives', 'career', 'career-decision', 'Speak to the relevant people once the decision point arrives', 'task', null, false, null, 3),
    ('career-decision:speak-to-sinead-before-she-proceeds-too-far-with-internal-recruitment-if-your-in', 'career', 'career-decision', 'Speak to Sinead before she proceeds too far with internal recruitment if your intentions materially affect it', 'task', null, false, null, 4),
    ('career-decision:keep-laura-informed-appropriately', 'career', 'career-decision', 'Keep Laura informed appropriately', 'task', null, false, null, 5),
    ('career-decision:begin-head-of-office-backfill-planning-if-you-move', 'career', 'career-decision', 'Begin Head of Office backfill planning if you move', 'task', 'Identify handover needs and agree timing with Anthony.', false, null, 6),
    ('career-decision:product-role', 'career', 'career-decision', 'Product role', 'watch', null, false, null, 0),
    ('career-decision:partnerships-role', 'career', 'career-decision', 'Partnerships role', 'watch', null, false, null, 1),
    ('career-decision:possible-head-of-office-backfill', 'career', 'career-decision', 'Possible Head of Office backfill', 'watch', null, false, null, 2),
    ('per-grassroot:send-price-breakdowns-per-unit-for-dtc-kegs-and-cans', 'per', 'per-grassroot', 'Send price breakdowns per unit for DTC, kegs and cans', 'task', null, false, null, 0),
    ('per-grassroot:create-a-benchmark-reference-product-package', 'per', 'per-grassroot', 'Create a benchmark reference-product package', 'task', 'Including Cruzcampo Radler and ginger examples', false, null, 1),
    ('per-grassroot:note-what-you-like-about-sweetness-citrus-and-ginger-heat', 'per', 'per-grassroot', 'Note what you like about sweetness, citrus and ginger heat', 'task', null, false, null, 2),
    ('per-grassroot:check-bottles-from-the-pilot-batch-for-the-clumping-issue', 'per', 'per-grassroot', 'Check bottles from the pilot batch for the clumping issue', 'task', null, false, null, 3),
    ('per-grassroot:confirm-whether-the-affected-batch-appears-safe-and-stable', 'per', 'per-grassroot', 'Confirm whether the affected batch appears safe and stable', 'task', null, false, null, 4),
    ('per-grassroot:send-fresh-samples-to-hannah-if-the-current-batch-is-problematic', 'per', 'per-grassroot', 'Send fresh samples to Hannah if the current batch is problematic', 'task', null, false, null, 5),
    ('per-property:send-tony-links-to-any-property-you-are-seriously-considering-before-making-an-o', 'per', 'per-property', 'Send Tony links to any property you are seriously considering before making an offer', 'task', null, false, null, 0);

  -- Changed items — but never a row you have edited.
  with upd as (
    update public.tasks t
       set stream_id = s.stream_id, section_id = s.section_id, title = s.title,
           kind = s.kind, context = s.context, do_now = s.do_now,
           due = s.due, position = s.position, deleted_at = null
      from _seed s
     where t.owner_id = owner
       and t.natural_key = s.natural_key
       and t.user_edited = false
    returning 1)
  select count(*) into n_upd from upd;

  -- New items.
  with ins as (
    insert into public.tasks
      (owner_id, stream_id, section_id, natural_key, title, kind, context, do_now, due, position)
    select owner, s.stream_id, s.section_id, s.natural_key, s.title, s.kind,
           s.context, s.do_now, s.due, s.position
      from _seed s
     where not exists (
       select 1 from public.tasks t
        where t.owner_id = owner and t.natural_key = s.natural_key)
    returning 1)
  select count(*) into n_ins from ins;

  -- Gone from the seed — retired, unless you finished or edited it.
  with ret as (
    update public.tasks t
       set deleted_at = now()
     where t.owner_id = owner
       and t.natural_key is not null
       and t.deleted_at is null
       and t.user_edited = false
       and t.done = false
       and not exists (select 1 from _seed s where s.natural_key = t.natural_key)
    returning 1)
  select count(*) into n_ret from ret;

  -- ── who you are waiting on ───────────────────────────────────────
  create temp table _links (natural_key text, person text) on commit drop;
  insert into _links values
    ('cttl-fell:forward-fellowship-document-and-agenda-email-to-dale', 'Dale'),
    ('cttl-fell:send-original-fellowship-submission-document-to-matty', 'Matty'),
    ('cttl-aus:check-with-steph-that-satyas-proposed-flights-can-be-booked-through-nhsbt', 'Steph'),
    ('cttl-aus:check-with-steph-that-satyas-proposed-flights-can-be-booked-through-nhsbt', 'Satya'),
    ('cttl-aus:speak-to-steph-first-then-have-steph-contact-satya-directly-about-travel', 'Steph'),
    ('cttl-aus:speak-to-steph-first-then-have-steph-contact-satya-directly-about-travel', 'Satya'),
    ('cttl-aus:chase-belaal-for-an-update-on-satyas-australia-trip', 'Belaal'),
    ('cttl-aus:chase-belaal-for-an-update-on-satyas-australia-trip', 'Satya'),
    ('cttl-aus:escalate-to-anthony-if-belaal-does-not-respond', 'Anthony'),
    ('cttl-aus:escalate-to-anthony-if-belaal-does-not-respond', 'Belaal'),
    ('cttl-aus:mail-cttl-leaflets-to-dale-ahead-of-the-australia-trip', 'Dale'),
    ('cttl-aus:arrange-to-share-satyas-taxi-to-the-hotel-on-wednesday-morning', 'Satya'),
    ('cttl-aus:satya-contract', 'Satya'),
    ('cttl-aus:satya-australia-travel', 'Satya'),
    ('cttl-read:read-and-ai-analyse-journey-to-equity-dale-and-gurch-material', 'Dale'),
    ('cttl-read:read-and-ai-analyse-journey-to-equity-dale-and-gurch-material', 'Gurch'),
    ('isodp-spons:send-anthony-the-short-priority-sponsor-list', 'Anthony'),
    ('isodp-spons:schedule-time-with-anthony-to-go-through-the-sponsor-outreach-spreadsheet', 'Anthony'),
    ('isodp-spons:prepare-a-short-chasing-text-anthony-can-use-with-priority-sponsors', 'Anthony'),
    ('isodp-spons:draft-sponsor-outreach-email-for-anthony-with-the-sponsorship-pack-link', 'Anthony'),
    ('isodp-spons:follow-up-emma-on-her-sponsor-list', 'Emma'),
    ('isodp-spons:follow-up-derek-on-his-sponsor-list', 'Derek'),
    ('isodp-spons:share-sponsor-list-with-derek', 'Derek'),
    ('isodp-spons:follow-up-matt-weis-regarding-sponsor-outreach', 'Matt Weis'),
    ('isodp-spons:follow-up-matt-weis-regarding-sponsor-outreach', 'Matt'),
    ('isodp-spons:touch-base-with-jeff-on-board-member-sponsorship-activity', 'Jeff'),
    ('isodp-spons:jeffs-board-outreach', 'Jeff'),
    ('isodp-spons:emmas-outreach', 'Emma'),
    ('isodp-spons:dereks-outreach', 'Derek'),
    ('isodp-spons:matt-weis-outreach', 'Matt Weis'),
    ('isodp-spons:matt-weis-outreach', 'Matt'),
    ('isodp-organox:set-up-a-call-including-anthony', 'Anthony'),
    ('isodp-organox:speak-to-derek-about-senior-escalation-through-peter', 'Derek'),
    ('isodp-organox:speak-to-derek-about-senior-escalation-through-peter', 'Peter'),
    ('isodp-organox:provide-derek-with-the-sponsorship-pack', 'Derek'),
    ('isodp-organox:keep-dales-intelligence-on-peters-current-organox-involvement-in-view', 'Dale'),
    ('isodp-organox:keep-dales-intelligence-on-peters-current-organox-involvement-in-view', 'Peter'),
    ('isodp-china:check-with-anthony-and-dhsc-if-necessary', 'Anthony'),
    ('isodp-leads:pick-up-the-invita-opportunity-with-rebecca', 'Rebecca'),
    ('isodp-leads:brief-dale-on-beatrice-and-marty-sponsor-conversations-in-sydney', 'Dale'),
    ('isodp-leads:brief-dale-on-beatrice-and-marty-sponsor-conversations-in-sydney', 'Beatrice'),
    ('isodp-leads:brief-dale-on-beatrice-and-marty-sponsor-conversations-in-sydney', 'Marty'),
    ('isodp-leads:review-aras-sponsorship-proposal-and-take-it-to-loc', 'Ara'),
    ('isodp-leads:ask-kirsty-head-of-charity-to-support-the-ba-sponsorship-application', 'Kirsty'),
    ('isodp-coll:ensure-emma-has-the-final-sponsorship-brochure', 'Emma'),
    ('isodp-coll:ensure-emma-has-sponsor-contacts-assigned-to-her', 'Emma'),
    ('isodp-coll:ensure-emma-has-sponsorship-document-access', 'Emma'),
    ('isodp-coll:send-emma-an-introductory-email-explaining-isodp', 'Emma'),
    ('isodp-coll:speak-to-lauren-about-reflecting-confirmed-sponsors-in-the-brochure', 'Lauren'),
    ('isodp-coll:send-the-congress-graphic-and-video-file-to-lauren-for-the-website', 'Lauren'),
    ('isodp-pay:draft-escalation-email-for-anthony-to-send-to-mark-taylor', 'Anthony'),
    ('isodp-pay:draft-escalation-email-for-anthony-to-send-to-mark-taylor', 'Mark Taylor'),
    ('isodp-pay:set-up-a-daytime-call-with-anthony-isaac-and-john-richardson', 'Anthony'),
    ('isodp-pay:set-up-a-daytime-call-with-anthony-isaac-and-john-richardson', 'Isaac'),
    ('isodp-pay:set-up-a-daytime-call-with-anthony-isaac-and-john-richardson', 'John Richardson'),
    ('isodp-pay:ask-isaac-who-the-correct-named-finance-contact-is', 'Isaac'),
    ('isodp-pay:set-up-a-three-way-call-with-isaac-and-that-person-if-needed', 'Isaac'),
    ('isodp-pay:call-suzanne-about-receiving-payments-in-usd-versus-gbp-and-exchange-rate-handli', 'Suzanne'),
    ('isodp-pay:ask-suzanne-how-currency-and-international-payments-were-handled-at-previous-con', 'Suzanne'),
    ('isodp-pay:re-run-registration-cost-numbers-with-isaac', 'Isaac'),
    ('isodp-mystery:check-with-suzanne-and-tts-whether-it-originated-through-them', 'Suzanne'),
    ('isodp-abs:speak-to-suzanne-about-abstract-categories-awards-and-submission-rules', 'Suzanne'),
    ('isodp-abs:chase-matt-and-dale-for-final-abstract-categories-and-awards-information', 'Dale'),
    ('isodp-abs:chase-matt-and-dale-for-final-abstract-categories-and-awards-information', 'Matt'),
    ('isodp-abs:tell-candy-and-the-oxford-team-they-can-build-around-the-working-13-categories', 'Candy'),
    ('isodp-awards:get-existing-award-details-from-suzanne', 'Suzanne'),
    ('isodp-prog:keep-dr-koval-and-ukraine-plenary-participation-on-the-radar', 'Dr Koval'),
    ('isodp-prog:dr-koval', 'Dr Koval'),
    ('isodp-accred:have-dale-speak-to-sylvia-paris-regarding-cme-and-accreditation-needs', 'Dale'),
    ('isodp-accred:have-anthony-pursue-uk-accreditation-once-programme-and-speakers-are-sufficientl', 'Anthony'),
    ('isodp-accred:have-anthony-pursue-uk-accreditation-once-programme-and-speakers-are-sufficientl', 'Dale'),
    ('isodp-web:review-lauren-and-candys-initial-website-build', 'Lauren'),
    ('isodp-web:review-lauren-and-candys-initial-website-build', 'Candy'),
    ('dir-people:review-anthonys-previous-conflicts-of-interest-email', 'Anthony'),
    ('dir-steph:finalise-stephs-pdpr', 'Steph'),
    ('dir-steph:try-to-arrange-stephs-blood-donation-visit', 'Steph'),
    ('dir-office:sort-satyas-honorary-contract', 'Satya'),
    ('dir-office:chase-satyas-contract-through-an-alternative-route-if-stalled', 'Satya'),
    ('dir-restructure:anthony-and-bilal-discussion-on-interim-versus-substantive-director', 'Anthony'),
    ('dir-restructure:anthonys-own-position-and-appetite-for-the-future-role', 'Anthony'),
    ('dir-digital:speak-to-anthony-about-splitting-your-time-so-you-can-begin-working-with-laura', 'Anthony'),
    ('dir-digital:speak-to-anthony-about-splitting-your-time-so-you-can-begin-working-with-laura', 'Laura'),
    ('dir-digital:send-the-texas-paper-to-laura', 'Laura'),
    ('dir-perf:speak-to-anthony-about-whether-the-organ-donation-session-should-be-postponed-un', 'Anthony'),
    ('dir-perf:respond-to-kanaks-workshop-email-with-the-right-contacts', 'Laura'),
    ('dir-session:find-and-share-notes-containing-anthonys-brainstorming-ideas', 'Anthony'),
    ('dir-session:reach-out-to-kate-or-mark-taylors-team-if-required-regarding-sdg-planning', 'Mark Taylor'),
    ('dir-events:prepare-anthonys-speaking-notes-for-the-partner-and-stakeholder-webinar', 'Anthony'),
    ('dir-honours:speak-to-derek-for-evidence-and-context', 'Derek'),
    ('dir-honours:obtain-supporting-letters', 'Anthony'),
    ('dir-honours:obtain-supporting-letters', 'Derek'),
    ('career-decision:keep-laura-informed-appropriately', 'Laura'),
    ('career-decision:begin-head-of-office-backfill-planning-if-you-move', 'Anthony');

  delete from public.task_people tp
   using public.tasks t
   where tp.task_id = t.id and t.owner_id = owner and t.natural_key is not null;

  insert into public.task_people (task_id, person_id, owner_id)
  select t.id, p.id, owner
    from _links l
    join public.tasks t on t.owner_id = owner and t.natural_key = l.natural_key
    join public.people p on p.owner_id = owner and p.name = l.person
  on conflict do nothing;

  raise notice 'Seeded as %: % inserted, % updated, % retired.',
    owner_email, n_ins, n_upd, n_ret;
end
$seed$;

-- Confirm. Expect 201 tasks and 54 to watch.
select kind, count(*) as items
  from public.tasks
 where deleted_at is null
 group by kind
 order by kind;
