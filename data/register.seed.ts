/**
 * THE SEED SOURCE OF TRUTH.
 *
 * Edit this file, run `npm run seed`, and the database is reconciled:
 * new items inserted, changed titles/notes/flags updated, removed items
 * soft-deleted. Your own edits (done state, notes you wrote, reschedules,
 * promotions) are never overwritten. See README "Re-seeding".
 *
 * Every item gets a stable natural key derived from `${sectionId}:${slug(title)}`
 * so re-seeding is idempotent.
 *
 * STATUS: INCOMPLETE — see docs/DATA-GAP.md
 * The appendix supplied in the brief was truncated mid-way through
 * section `isodp-accred`. Sections after that point, the whole of the
 * `dir`, `career` and `per` streams, and the entire WATCH block are
 * not yet present. Placeholders below mark where they go.
 */

export type StreamId = 'cttl' | 'isodp' | 'dir' | 'career' | 'per';

export interface ItemOpts {
  /** priority flag — "do now" */
  p?: 1;
  /** ISO date */
  due?: string;
  note?: string;
}
export interface Item extends ItemOpts { t: string }

export interface Section {
  id: string;
  stream: StreamId;
  title: string;
  /** tracked but not driven — read-only register, not a to-do list */
  monitor?: boolean;
  items: (string | Item)[];
  /** "needs remembering" material attached to this section */
  watch?: (string | Item)[];
}

const P = (t: string, o?: ItemOpts): Item => ({ t, ...o });

/**
 * title — the full name, used on the stream page and in screen-reader labels
 * short — the display name, used wherever space is tight (cards, headers)
 * code  — the pill on a task row
 */
export const STREAMS = {
  cttl:   { title: 'Commonwealth Tribute to Life', short: 'Commonwealth', code: 'CTtL' },
  isodp:  { title: 'ISODP 2027',                   short: 'ISODP 2027',   code: 'ISODP' },
  dir:    { title: 'Directorate',                  short: 'Directorate',  code: 'Dir' },
  career: { title: 'Career',                       short: 'Career',       code: 'Career' },
  per:    { title: 'Personal',                     short: 'Personal',     code: 'Per' },
} as const;

export const SECTIONS: Section[] = [
{id:'cttl-gov',stream:'cttl',title:'Governance and meetings',items:[
 P("Send formal invitations for the Custodian Board meeting",{p:1,note:"9 October, 1-2pm. Agenda to follow."}),
 P("Compile confirmed Custodian Board member list",{p:1}),
 "Set up Regional Coordinator meeting",
 "Answer and follow up with Serbian contacts",
 "Locate and share latest logo use and event recognition governance document"]},
{id:'cttl-fell',stream:'cttl',title:'Fellowship',items:[
 P("Update CTtL website with Fellowship information",{p:1}),
 P("Add placeholder for the Fellowship application form",{p:1}),
 P("Formulate and circulate the Fellowship timeline",{p:1,note:"Advertise by / applications by / interview dates / intended appointment and start"}),
 "Forward Fellowship document and agenda email to Dale",
 "Send original Fellowship submission document to Matty"]},
{id:'cttl-aus',stream:'cttl',title:'Australia and Sydney',items:[
 P("Check with Steph that Satya's proposed flights can be booked through NHSBT",{p:1,note:"Emirates. Birmingham to Sydney outbound 14 September, return 25 September via Singapore to Manchester."}),
 P("Speak to Steph first, then have Steph contact Satya directly about travel",{p:1}),
 P("Chase Belaal for an update on Satya's Australia trip",{p:1}),
 "Escalate to Anthony if Belaal does not respond",
 "Push South Australia tickets through",
 "Mail CTtL leaflets to Dale ahead of the Australia trip",
 "Find Sydney event brochure and advertising material",
 "Calculate exact number of signatory countries",
 "Calculate exact percentage of Commonwealth population covered",
 "Calculate exact number of organisations involved in CTtL",
 "Arrange to share Satya's taxi to the hotel on Wednesday morning"]},
{id:'cttl-read',stream:'cttl',title:'Reading and development',items:[
 "Read and AI-analyse Journey to Equity, Dale and Gurch material",
 "Review ARC Discovery slides and data",
 "Pull out practical implications for CTtL, equity and donation strategy rather than just reading them"]},

{id:'isodp-spons',stream:'isodp',title:'Sponsorship — overall management',items:[
 P("Send Anthony the short priority sponsor list",{p:1,note:"Quad, MVTA, transplant-related leads, TransMedics"}),
 "Schedule time with Anthony to go through the sponsor outreach spreadsheet",
 "Prepare a short chasing text Anthony can use with priority sponsors",
 "Draft sponsor outreach email for Anthony with the sponsorship pack link",
 "Produce and maintain the sponsorship recap",
 "Keep the sponsor pipeline current",
 "Follow up Emma on her sponsor list",
 "Follow up Derek on his sponsor list",
 "Share sponsor list with Derek",
 "Follow up Matt Weis regarding sponsor outreach",
 "Touch base with Jeff on Board member sponsorship activity",
 "Continue seeking strong UK-based sponsors"]},
{id:'isodp-organox',stream:'isodp',title:'Sponsorship — OrganOx',items:[
 "Follow up the OrganOx UK marketing manager",
 "Set up a call including Anthony",
 "Speak to Derek about senior escalation through Peter",
 "Provide Derek with the sponsorship pack",
 "Keep Dale's intelligence on Peter's current OrganOx involvement in view"]},
{id:'isodp-china',stream:'isodp',title:'Sponsorship — Chinese and TransNovo',items:[
 P("Clarify exactly what they want",{p:1,note:"Platinum sponsorship, pre-Congress workshop, speaking slot, or a combination"}),
 P("Clarify the actual sponsoring entity",{p:1,note:"TransNovo, COTDF or another associated company"}),
 P("Clarify which organisation will actually make payment",{p:1}),
 "Keep the Chinese contact warm",
 "Favour TransNovo as the named sponsor where possible",
 "Check reputational and governance implications",
 "Check with Anthony and DHSC if necessary",
 "Establish sensible cancellation and non-refundable sponsorship terms",
 "Aim to collect major sponsorship funds early"]},
{id:'isodp-leads',stream:'isodp',title:'Sponsorship — other leads',items:[
 P("Convert the Getinge pencilled commitment into formal confirmation",{p:1}),
 P("Get European outreach underway before Sydney",{p:1}),
 "Track Getinge potential platinum sponsorship",
 "Pick up the Invita opportunity with Rebecca",
 "Establish whether NHSBT Blood CRM procurement creates a sponsorship or conflict issue before progressing",
 P("Track Global Transplant Solutions",{note:"Approximately $10k budgeted"}),
 "Track Organ Recovery Systems follow-up",
 "Track Fusion Fluids",
 "Track wider European and Spanish prospects",
 "Brief Dale on Beatrice and Marty sponsor conversations in Sydney",
 "Review Ara's sponsorship proposal and take it to LOC",
 "Put together the BA sponsorship proposal against BA criteria",
 "Ask Kirsty, Head of Charity, to support the BA sponsorship application"]},
{id:'isodp-coll',stream:'isodp',title:'Sponsorship — collateral',items:[
 "Ensure Emma has the final sponsorship brochure",
 "Ensure Emma has sponsor contacts assigned to her",
 "Ensure Emma has sponsorship document access",
 "Send Emma an introductory email explaining ISODP",
 "Speak to Lauren about reflecting confirmed sponsors in the brochure",
 "Update the sponsorship brochure as sponsors confirm",
 "Send the final brochure to Congress Board",
 "Summarise the sponsorship discussion by email when useful",
 "Send the congress graphic and video file to Lauren for the website"]},
{id:'isodp-pay',stream:'isodp',title:'Finance — sponsor payment process',items:[
 P("Clarify the end-to-end process for sponsors paying NHSBT",{p:1}),
 P("Draft escalation email for Anthony to send to Mark Taylor",{p:1,note:"Make clear sponsors are ready to pay but currently lack a workable payment route."}),
 P("Set up a daytime call with Anthony, Isaac and John Richardson",{p:1}),
 "Ask Isaac who the correct named finance contact is",
 "Set up a three-way call with Isaac and that person if needed",
 "Clarify invoicing, bank details and international transfers",
 "Clarify payment references, VAT and exchange-rate handling",
 "Clarify fees, deductions, refunds and cancellation",
 "Ask Finance and Accounts about VAT treatment on sponsorship",
 "Check with the Finance Committee whether a Stripe portal or similar invoicing solution is possible",
 "Call Suzanne about receiving payments in USD versus GBP and exchange-rate handling",
 "Ask Suzanne how currency and international payments were handled at previous Congresses",
 "Confirm with Oxford Abstracts how they handle multi-currency payments",
 "Re-run registration cost numbers with Isaac",
 P("Dig into the old budget sheet and confirm speaker policy",{note:"Flights, accommodation, registration"})]},
{id:'isodp-mystery',stream:'isodp',title:'Finance — the unexplained payment',items:[
 P("Investigate the unexplained €1,085 payment",{note:"Approximately £910"}),
 "Identify the sender",
 "Establish why it was paid",
 "Establish how the sender obtained ISODP payment details",
 "Confirm the correct accounting treatment",
 "Check with Suzanne and TTS whether it originated through them"]},
{id:'isodp-budget',stream:'isodp',title:'Finance — budget management',items:[
 "Add a forecast of major expenditure to the budget tracker",
 "Upload the budget tracking document to SharePoint"]},
{id:'isodp-abs',stream:'isodp',title:'Programme — abstracts',items:[
 "Find the number of accepted oral abstracts at Kyoto",
 "Speak to Suzanne about abstract categories, awards and submission rules",
 "Chase Matt and Dale for final abstract categories and awards information",
 "Tell Candy and the Oxford team they can build around the working 13 categories",
 "Update the system if the final SPC decision changes the categories",
 "Track SPC decisions on invited speakers, oral abstracts, mini abstracts and abstract-only sessions"]},
{id:'isodp-awards',stream:'isodp',title:'Programme — awards',items:[
 "Get existing award details from Suzanne",
 "Feed award details into the Oxford and website build",
 "Track Executive Council decisions on top abstract and poster awards",
 "Track decisions on travel scholarships and speaker support",
 "Track decisions on young investigator and emerging economy awards",
 "Incorporate final decisions into website, abstract platform, communications and budget"]},
{id:'isodp-prog',stream:'isodp',title:'Programme — development',items:[
 "Keep Dr Koval and Ukraine plenary participation on the radar",
 "Ensure programme information needed for website and accreditation is captured as it firms up"]},
{id:'isodp-web',stream:'isodp',title:'Website',items:[
 "Review Lauren and Candy's initial website build",
 "Respond with consolidated feedback",
 "Ensure development proceeds towards isodp2027.com",
 "Improve navigation compared with Kyoto",
 "Make sure important information does not sit buried on long pages",
 "Ensure clear sections for registration, abstracts, programme and awards",
 "Ensure clear sections for accommodation, sponsorship and venue",
 "Review IPDA and other TTS Congress sites as reference models",
 "Ensure the latest sponsorship brochure and confirmed sponsors are reflected",
 "Ensure the congress graphic and video is incorporated"]},
{id:'isodp-hotels',stream:'isodp',title:'Hotels and accommodation',items:[
 P("Start accommodation work now",{p:1}),
 "Contact the QEII Centre about preferred hotel relationships and rates",
 "Investigate HotelMap",
 "Determine whether HotelMap can be embedded or linked cleanly from the website",
 "Identify preferred hotels close to QEII",
 "Identify a potential headquarters hotel",
 "Consider a hotel suitable for Executive and Council, speakers and organising team",
 "Explore group and room-block booking",
 "Determine how speaker accommodation should be managed",
 "Bring actual hotel options and indicative rates to LOC rather than only discussing the concept"]},
{id:'isodp-social',stream:'isodp',title:'Social events and logistics',items:[
 "Develop 007 gala dinner ideas in the shared LOC folder",
 P("Follow up Houses of Parliament dinner possibilities",{note:"Capacity, regulations, costs, practical feasibility"}),
 "Contact the aquarium venue about the President's Dinner",
 "Contact OXO Tower about the President's Dinner",
 "Review LOC meeting notes and provide feedback"]},

// ─────────────────────────────────────────────────────────────────────
// TRUNCATION POINT. The brief's appendix was cut off here, mid-section,
// at:  {id:'isodp-accred',stream:'isodp',title:'Accre…
// Everything below this line is missing from the source material:
//   • the remainder of `isodp-accred` and any later isodp sections
//   • the entire `dir` (Directorate) stream
//   • the entire `career` stream
//   • the entire `per` (Personal) stream
//   • the entire WATCH block (~50 "needs remembering" items)
// See docs/DATA-GAP.md.
// ─────────────────────────────────────────────────────────────────────
];
