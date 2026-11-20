"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/keystone/access.ts
var access_exports = {};
__export(access_exports, {
  canAccessFleet: () => canAccessFleet,
  canFilterThrough: () => canFilterThrough,
  currentHumanActor: () => currentHumanActor,
  financeAccess: () => financeAccess,
  fleetIdsFor: () => fleetIdsFor,
  fleetScopedAccess: () => fleetScopedAccess,
  hasAnyFleetScope: () => hasAnyFleetScope,
  hasPermission: () => hasPermission,
  humanSessionId: () => humanSessionId,
  isGlobalAdministrator: () => isGlobalAdministrator,
  isOperator: () => isOperator,
  isSignedIn: () => isSignedIn,
  lockedFleetAccess: () => lockedFleetAccess,
  lockedOperationalAccess: () => lockedOperationalAccess,
  operatorAccess: () => operatorAccess,
  permissionNames: () => permissionNames,
  permissions: () => permissions,
  relationFilter: () => relationFilter,
  safetyAccess: () => safetyAccess
});
function humanSessionId(session2) {
  if (session2?.listKey !== "User" || typeof session2.itemId !== "string" || !session2.itemId) return null;
  if (["apiKeyId", "apiKeyScopes", "oauthScopes", "customerToken"].some((key) => Object.prototype.hasOwnProperty.call(session2, key)) || Object.prototype.hasOwnProperty.call(session2.data || {}, "machine")) return null;
  return session2.itemId;
}
async function currentHumanActor(db, session2) {
  const actorId = humanSessionId(session2);
  if (!actorId) return null;
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { id: true, roleId: true } });
  return actor?.id === actorId ? actor : null;
}
async function hasPermission(permission, { context, session: session2 }) {
  const actor = await currentHumanActor(context.prisma, session2);
  if (!actor?.roleId) return false;
  const role = await context.prisma.role.findFirst({
    where: { id: actor.roleId, [permission]: true, assignedTo: { some: { id: actor.id } } },
    select: { id: true }
  });
  return role?.id === actor.roleId;
}
function membershipWhere(actorId, capability) {
  return { userId: actorId, user: { is: { id: actorId } }, fleet: { isNot: null }, status: "active", role: { in: membershipRoles[capability] } };
}
async function fleetIdsFor(context, session2, capability) {
  const actor = await currentHumanActor(context.prisma, session2);
  if (!actor) return [];
  const ids = /* @__PURE__ */ new Set();
  let after;
  for (; ; ) {
    const memberships = await context.prisma.fleetMembership.findMany({
      where: { ...membershipWhere(actor.id, capability), ...after ? { id: { gt: after } } : {} },
      orderBy: { id: "asc" },
      take: 200,
      select: { id: true, fleetId: true }
    });
    for (const membership of memberships) if (membership.fleetId) ids.add(membership.fleetId);
    if (memberships.length < 200) return [...ids];
    const last2 = memberships[memberships.length - 1].id;
    if (last2 === after) throw new Error("Fleet authority continuation did not advance.");
    after = last2;
  }
}
async function canAccessFleet(context, session2, fleetId, capability) {
  if (!fleetId || !humanSessionId(session2)) return false;
  const fleet = await context.prisma.fleet.findUnique({ where: { id: fleetId }, select: { id: true } });
  if (fleet?.id !== fleetId) return false;
  if (await isGlobalAdministrator({ context, session: session2 })) return true;
  const actor = await currentHumanActor(context.prisma, session2);
  if (!actor) return false;
  const membership = await context.prisma.fleetMembership.findFirst({
    where: { ...membershipWhere(actor.id, capability), fleetId },
    select: { id: true }
  });
  return Boolean(membership);
}
async function fleetScopeWhere({ context, session: session2, listKey }, capability) {
  if (!humanSessionId(session2)) return false;
  if (await isGlobalAdministrator({ context, session: session2 })) return true;
  const ids = await fleetIdsFor(context, session2, capability);
  if (!ids.length) return false;
  const filter = fleetWhereByList[listKey];
  return filter ? filter(ids) : false;
}
async function hasAnyFleetScope(context, session2, capability) {
  if (!humanSessionId(session2)) return false;
  if (await isGlobalAdministrator({ context, session: session2 })) return true;
  const actor = await currentHumanActor(context.prisma, session2);
  if (!actor) return false;
  return Boolean(await context.prisma.fleetMembership.findFirst({ where: membershipWhere(actor.id, capability), select: { id: true } }));
}
function fleetScopedAccess(capability) {
  return {
    operation: {
      query: ({ context, session: session2 }) => hasAnyFleetScope(context, session2, capability),
      // Tenant relationships are immutable at the field boundary. Generic
      // creates cannot establish a legitimate parent; semantic setup owns them.
      create: () => false,
      update: ({ context, session: session2 }) => hasAnyFleetScope(context, session2, capability),
      // Mutable parents are archived/paused, never severed from history by CRUD.
      delete: () => false
    },
    filter: {
      query: (args) => fleetScopeWhere(args, capability),
      update: (args) => fleetScopeWhere(args, capability),
      delete: (args) => fleetScopeWhere(args, "fleetAdmin")
    }
  };
}
function lockedFleetAccess(capability) {
  return {
    ...fleetScopedAccess(capability),
    operation: { query: ({ context, session: session2 }) => hasAnyFleetScope(context, session2, capability), create: () => false, update: () => false, delete: () => false }
  };
}
var permissionNames, permissions, isSignedIn, isGlobalAdministrator, membershipRoles, fleetWhereByList, isOperator, operatorAccess, lockedOperationalAccess, financeAccess, safetyAccess, never, anyFleet, readsTarget, canFilterThrough, relationFilter;
var init_access = __esm({
  "features/keystone/access.ts"() {
    "use strict";
    permissionNames = [
      "canAccessDashboard",
      "canManagePeople",
      "canManageRoles",
      "canManageFleet",
      "canDispatchRides",
      "canManageDrivers",
      "canManageFinance",
      "canManageSafety",
      "canManageIntegrations",
      "canManageOnboarding"
    ];
    permissions = Object.fromEntries(permissionNames.map((name) => [name, (args) => hasPermission(name, args)]));
    isSignedIn = async ({ context, session: session2 }) => Boolean(await currentHumanActor(context.prisma, session2));
    isGlobalAdministrator = (args) => permissions.canManageRoles(args);
    membershipRoles = {
      operations: ["owner", "dispatcher"],
      drivers: ["owner", "dispatcher"],
      finance: ["owner", "finance"],
      safety: ["owner", "support"],
      fleetAdmin: ["owner"]
    };
    fleetWhereByList = {
      Fleet: (ids) => ({ id: { in: ids } }),
      FleetMembership: (ids) => ({ fleet: { id: { in: ids } } }),
      FleetBrandingChange: (ids) => ({ fleet: { id: { in: ids } } }),
      DriverProfile: (ids) => ({ fleet: { id: { in: ids } } }),
      Vehicle: (ids) => ({ fleet: { id: { in: ids } } }),
      RiderProfile: (ids) => ({ homeFleet: { id: { in: ids } } }),
      ServiceArea: (ids) => ({ fleet: { id: { in: ids } } }),
      RideService: (ids) => ({ fleet: { id: { in: ids } } }),
      AvailabilityRule: (ids) => ({ driver: { fleet: { id: { in: ids } } } }),
      AvailabilityException: (ids) => ({ driver: { fleet: { id: { in: ids } } } }),
      FareRule: (ids) => ({ fleet: { id: { in: ids } } }),
      ComplianceDocument: (ids) => ({ OR: [
        { driver: { fleet: { id: { in: ids } } } },
        { vehicle: { fleet: { id: { in: ids } } } }
      ] }),
      Policy: (ids) => ({ fleet: { id: { in: ids } } }),
      PolicyEvaluation: (ids) => ({ OR: [
        { driver: { fleet: { id: { in: ids } } } },
        { vehicle: { fleet: { id: { in: ids } } } },
        { policy: { fleet: { id: { in: ids } } } }
      ] }),
      ProviderConnection: (ids) => ({ fleet: { id: { in: ids } } }),
      MarketplaceRegistration: (ids) => ({ fleet: { id: { in: ids } } }),
      Notification: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      RideQuote: (ids) => ({ service: { fleet: { id: { in: ids } } } }),
      RideRequest: (ids) => ({ fleet: { id: { in: ids } } }),
      MatchOffer: (ids) => ({ OR: [
        { request: { fleet: { id: { in: ids } } } },
        { driver: { fleet: { id: { in: ids } } } }
      ] }),
      Trip: (ids) => ({ fleet: { id: { in: ids } } }),
      TripEvent: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      LocationEvent: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      Cancellation: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      SafetyIncident: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      SupportCase: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      Conversation: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      Message: (ids) => ({ conversation: { trip: { fleet: { id: { in: ids } } } } }),
      Review: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      Payment: (ids) => ({ trip: { fleet: { id: { in: ids } } } }),
      Refund: (ids) => ({ payment: { trip: { fleet: { id: { in: ids } } } } }),
      PaymentObservation: (ids) => ({ payment: { trip: { fleet: { id: { in: ids } } } } }),
      LedgerEntry: (ids) => ({ OR: [
        { trip: { fleet: { id: { in: ids } } } },
        { payment: { trip: { fleet: { id: { in: ids } } } } },
        { payout: { driver: { fleet: { id: { in: ids } } } } }
      ] }),
      Payout: (ids) => ({ driver: { fleet: { id: { in: ids } } } })
    };
    isOperator = async ({ context, session: session2 }) => hasAnyFleetScope(context, session2, "operations");
    operatorAccess = fleetScopedAccess("operations");
    lockedOperationalAccess = lockedFleetAccess("operations");
    financeAccess = {
      ...fleetScopedAccess("finance"),
      operation: { query: ({ context, session: session2 }) => hasAnyFleetScope(context, session2, "finance"), create: () => false, update: () => false, delete: () => false }
    };
    safetyAccess = fleetScopedAccess("safety");
    never = () => false;
    anyFleet = (capability) => ({ context, session: session2 }) => hasAnyFleetScope(context, session2, capability);
    readsTarget = {
      User: (args) => permissions.canManagePeople(args),
      Role: isSignedIn,
      RequestCancellationCommand: never,
      Fleet: anyFleet("fleetAdmin"),
      Policy: anyFleet("fleetAdmin"),
      ProviderConnection: anyFleet("fleetAdmin"),
      FareRule: anyFleet("fleetAdmin"),
      Notification: anyFleet("fleetAdmin"),
      MarketplaceRegistration: anyFleet("fleetAdmin"),
      FleetBrandingChange: anyFleet("fleetAdmin"),
      DriverProfile: anyFleet("drivers"),
      ComplianceDocument: anyFleet("drivers"),
      PolicyEvaluation: anyFleet("drivers"),
      RiderProfile: anyFleet("safety"),
      SafetyIncident: anyFleet("safety"),
      SupportCase: anyFleet("safety"),
      PaymentProvider: (args) => permissions.canManageFinance(args),
      Payment: anyFleet("finance"),
      Refund: anyFleet("finance"),
      PaymentObservation: anyFleet("finance"),
      LedgerEntry: anyFleet("finance"),
      Payout: anyFleet("finance")
    };
    canFilterThrough = (list13) => readsTarget[list13] ?? anyFleet("operations");
    relationFilter = (list13) => ({ isFilterable: canFilterThrough(list13) });
  }
});

// features/keystone/lib/email-layout.ts
function storeNameFromEnv(fallback = "Rideshare") {
  const match = /^\s*"?([^"<]+?)"?\s*</.exec(process.env.SMTP_FROM || "");
  return match?.[1]?.trim() || fallback;
}
function emailButton(label, href) {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
<tr><td class="em-btn" align="center" bgcolor="${C.button}" style="border-radius:8px;background:${C.button};">
<a class="em-btn-a" href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:${C.buttonText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}
function emailPanel(html, align = "left") {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
<tr><td class="em-panel" align="${align}" bgcolor="${C.panel}" style="padding:16px 18px;background:${C.panel};border:1px solid ${C.line};border-radius:8px;font-family:${FONT};font-size:15px;line-height:22px;color:${C.text};">${html}</td></tr></table>`;
}
function emailTotals(rows) {
  const last2 = rows.length - 1;
  const body = rows.map((row, i) => {
    const strong = i === last2;
    const style = strong ? `padding:12px 0 0;border-top:1px solid ${C.line};font-size:17px;line-height:24px;font-weight:700;color:${C.text};` : `padding:4px 0;font-size:14px;line-height:20px;color:${C.muted};`;
    const cls = strong ? "em-line em-text" : "em-muted";
    return `<tr><td class="${cls}" style="font-family:${FONT};${style}">${escapeHtml(row.label)}</td><td class="${cls}" align="right" style="font-family:${FONT};${style}white-space:nowrap;">${escapeHtml(row.value)}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 8px;">${body}</table>`;
}
function emailLayout(input) {
  const store = escapeHtml(input.storeName || storeNameFromEnv());
  const support = escapeHtml(input.supportEmail || SUPPORT_EMAIL);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
a { color:${C.link}; }
@media (max-width: 620px) { .em-pad { padding-left:20px !important; padding-right:20px !important; } }
@media (prefers-color-scheme: dark) {
  .em-canvas { background:#09090b !important; }
  .em-card { background:#18181b !important; border-color:#27272a !important; }
  .em-text { color:#fafafa !important; }
  .em-muted { color:#a1a1aa !important; }
  .em-line { border-color:#3f3f46 !important; }
  .em-panel { background:#27272a !important; border-color:#3f3f46 !important; color:#fafafa !important; }
  .em-btn { background:#fafafa !important; }
  .em-btn-a { color:#18181b !important; }
  .em-link { color:#fafafa !important; }
}
[data-ogsc] .em-text { color:#fafafa !important; }
[data-ogsc] .em-muted { color:#a1a1aa !important; }
[data-ogsb] .em-canvas { background:#09090b !important; }
[data-ogsb] .em-card { background:#18181b !important; }
</style>
</head>
<body class="em-canvas" style="margin:0;padding:0;background:${C.canvas};">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}</div>` : ""}
<table role="presentation" class="em-canvas" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td class="em-pad" style="padding:8px 32px 20px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.01em;"><span class="em-text" style="color:${C.text};">${store}</span></td></tr>
<tr><td class="em-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr><td class="em-pad" style="padding:32px 32px 16px;">
<h1 class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.02em;color:${C.text};">${escapeHtml(input.title)}</h1>
${input.body}
</td></tr>
</table>
</td></tr>
<tr><td class="em-pad" style="padding:20px 32px 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.subtle};">
<span class="em-muted" style="color:${C.subtle};">${input.footerNote ? `${input.footerNote}<br>` : ""}Questions? Email <a class="em-link" href="mailto:${support}" style="color:${C.muted};text-decoration:underline;">${support}</a>.<br>${store}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
var SUPPORT_EMAIL, FONT, C, escapeHtml, p, emailParagraph, emailMuted;
var init_email_layout = __esm({
  "features/keystone/lib/email-layout.ts"() {
    "use strict";
    SUPPORT_EMAIL = "hello@rideshare.openship.org";
    FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
    C = {
      canvas: "#f4f4f5",
      card: "#ffffff",
      text: "#18181b",
      muted: "#52525b",
      subtle: "#71717a",
      line: "#e4e4e7",
      panel: "#fafafa",
      button: "#18181b",
      buttonText: "#ffffff",
      link: "#18181b"
    };
    escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    p = (html, style = "") => `<p class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text};${style}">${html}</p>`;
    emailParagraph = p;
    emailMuted = (html) => `<p class="em-muted" style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:22px;color:${C.muted};">${html}</p>`;
  }
});

// features/keystone/lib/request-mail.ts
var request_mail_exports = {};
__export(request_mail_exports, {
  sendRequestReceivedEmail: () => sendRequestReceivedEmail
});
function transport() {
  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email delivery is not configured");
  return (0, import_nodemailer.createTransport)({ host: process.env.SMTP_HOST, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
}
async function sendRequestReceivedEmail(mail) {
  try {
    const info = await transport().sendMail({
      to: mail.to,
      from: process.env.SMTP_FROM,
      subject: `Ride request ${mail.requestNumber} received by ${mail.fleetName}`,
      html: emailLayout({
        storeName: mail.fleetName,
        preheader: `Ride request ${mail.requestNumber} received`,
        title: "We received your ride request",
        body: `${emailParagraph(`Thanks ${escapeHtml(mail.name)}. Request <strong>${escapeHtml(mail.requestNumber)}</strong> with ${escapeHtml(mail.fleetName)}.`)}
${emailPanel(`${escapeHtml(mail.whenLabel)}<br>From: ${escapeHtml(mail.pickup)}<br>To: ${escapeHtml(mail.dropoff)}`)}
${emailMuted("We will show your driver once one accepts.")}
${emailButton("View your rides", mail.link)}`
      })
    });
    return { sent: true, messageId: typeof info?.messageId === "string" ? info.messageId : void 0, response: typeof info?.response === "string" ? info.response : void 0 };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
var import_nodemailer;
var init_request_mail = __esm({
  "features/keystone/lib/request-mail.ts"() {
    "use strict";
    import_nodemailer = require("nodemailer");
    init_email_layout();
  }
});

// features/keystone/lib/request-confirmation.ts
var request_confirmation_exports = {};
__export(request_confirmation_exports, {
  deliverRequestReceived: () => deliverRequestReceived,
  normalizeReceiptEmail: () => normalizeReceiptEmail,
  requestConfirmationConfigured: () => requestConfirmationConfigured
});
function normalizeReceiptEmail(value) {
  if (value == null) return null;
  const invalid = () => new import_graphql2.GraphQLError("Enter a valid email address.", { extensions: { code: "BAD_USER_INPUT" } });
  if (typeof value !== "string") throw invalid();
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !EMAIL.test(email)) throw invalid();
  return email;
}
function requestConfirmationConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_STORE_LINK);
}
function receiptLink(request, extra) {
  const base = String(process.env.SMTP_STORE_LINK).replace(/\/$/, "");
  if (request.riderId || !extra.requestProof) return `${base}/account/rides`;
  const hash = new URLSearchParams({ r: request.id, n: request.requestNumber, p: extra.requestProof });
  return `${base}/#receipt=${hash.toString()}`;
}
async function deliverRequestReceived(prisma, requestId, send, extra = {}) {
  try {
    const request = await prisma.rideRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        riderId: true,
        requestNumber: true,
        requestedFor: true,
        pickupLabel: true,
        dropoffLabel: true,
        fleet: { select: { name: true, timezone: true } },
        rider: { select: { email: true, name: true } }
      }
    });
    if (!request) return;
    let row;
    try {
      row = await prisma.notification.create({
        data: { recipientId: request.riderId || null, channel: "email", templateKey: "ride_request_received", status: "sending", payload: { requestId: request.id, requestNumber: request.requestNumber, ...extra.receiptEmail ? { receiptEmail: extra.receiptEmail } : {} }, idempotencyKey: `ride-request-received:${request.id}` },
        select: { id: true }
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      return;
    }
    const mark = (status, error, messageId, response) => prisma.notification.update({ where: { id: row.id }, data: { status, ...messageId ? { providerReference: messageId.slice(0, 200) } : {}, ...response ? { payload: { requestId: request.id, requestNumber: request.requestNumber, ...extra.receiptEmail ? { receiptEmail: extra.receiptEmail } : {}, smtpResponse: response.slice(0, 300) } } : {}, ...status === "sent" ? { sentAt: /* @__PURE__ */ new Date() } : {}, ...error ? { lastError: error.slice(0, 200) } : {} } });
    try {
      const email = extra.receiptEmail || request.rider?.email;
      if (!email) {
        await mark("skipped_no_recipient");
        return;
      }
      if (!requestConfirmationConfigured()) {
        await mark("skipped_not_configured");
        return;
      }
      const zone = request.fleet?.timezone || "UTC";
      const whenLabel = request.requestedFor ? `Scheduled for ${new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(request.requestedFor))}` : "As soon as a driver is available";
      const sender = send || (await Promise.resolve().then(() => (init_request_mail(), request_mail_exports))).sendRequestReceivedEmail;
      const result = await sender({
        to: email,
        fleetName: request.fleet?.name || "Your ride service",
        requestNumber: request.requestNumber,
        name: request.rider?.name || "there",
        whenLabel,
        pickup: request.pickupLabel,
        dropoff: request.dropoffLabel,
        link: receiptLink(request, extra)
      });
      await (result.sent ? mark("sent", void 0, result.messageId, result.response) : mark("failed", result.error || "send_failed"));
    } catch (error) {
      try {
        await mark("failed", error instanceof Error ? error.message : "send_failed");
      } catch {
      }
    }
  } catch (error) {
    console.error("Ride request confirmation bookkeeping failed:", error instanceof Error ? error.message : "unknown");
  }
}
var import_graphql2, EMAIL;
var init_request_confirmation = __esm({
  "features/keystone/lib/request-confirmation.ts"() {
    "use strict";
    import_graphql2 = require("graphql");
    EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }
});

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  capturePaymentFunction: () => capturePaymentFunction,
  createPaymentFunction: () => createPaymentFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  refundPaymentFunction: () => refundPaymentFunction
});
async function createPaymentFunction({ trip, amount, currency, idempotencyKey }) {
  return { status: "pending", externalId: `manual:${trip.id}:${idempotencyKey || "unkeyed"}`, amount, currency, disclosure: "Manual adapter records an obligation; it does not authorize or move money." };
}
async function capturePaymentFunction({ paymentId, amount, currency }) {
  return { status: "pending", externalId: paymentId, amount, currency, disclosure: "Manual adapter cannot capture or claim receipt of funds." };
}
async function refundPaymentFunction({ paymentId, amount, currency }) {
  return { status: "processing", externalId: paymentId, amount, currency, disclosure: "Manual adapter cannot issue or claim a refund." };
}
async function getPaymentStatusFunction({ paymentId }) {
  return { status: "pending", externalId: paymentId, disclosure: "Manual adapter has no external payment status." };
}
async function handleWebhookFunction() {
  throw new Error("The manual adapter does not accept webhooks.");
}
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
  }
});

// features/integrations/payment/stripeSignature.ts
function stripeWebhookSecret() {
  const secret2 = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  return /^whsec_[A-Za-z0-9+/=_-]{8,}$/.test(secret2) ? secret2 : null;
}
function verifyStripeSignature(rawBody, header, secret2, now = Date.now(), toleranceSeconds = 300) {
  if (!header || !secret2) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp9 = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean);
  if (!timestamp9 || !/^\d{9,12}$/.test(timestamp9) || !signatures.length) return false;
  if (Math.abs(now / 1e3 - Number(timestamp9)) > toleranceSeconds) return false;
  const expected = (0, import_node_crypto6.createHmac)("sha256", secret2).update(`${timestamp9}.${rawBody}`).digest();
  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    return (0, import_node_crypto6.timingSafeEqual)(Buffer.from(signature, "hex"), expected);
  });
}
var import_node_crypto6;
var init_stripeSignature = __esm({
  "features/integrations/payment/stripeSignature.ts"() {
    "use strict";
    import_node_crypto6 = require("node:crypto");
  }
});

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  capturePaymentFunction: () => capturePaymentFunction2,
  chargeSavedCard: () => chargeSavedCard,
  createCardSetupSession: () => createCardSetupSession,
  createPaymentFunction: () => createPaymentFunction2,
  createStripeCustomer: () => createStripeCustomer,
  detachPaymentMethod: () => detachPaymentMethod,
  findRefundByKey: () => findRefundByKey,
  findSavedCardIntent: () => findSavedCardIntent,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  refundLateCheckout: () => refundLateCheckout,
  refundPaymentFunction: () => refundPaymentFunction2,
  retrieveCheckoutSession: () => retrieveCheckoutSession,
  retrievePaymentIntent: () => retrievePaymentIntent,
  retrieveRefund: () => retrieveRefund,
  retrieveSetupSession: () => retrieveSetupSession,
  stripeSecretKey: () => stripeSecretKey,
  stripeWebhookSecret: () => stripeWebhookSecret,
  verifyStripeSignature: () => verifyStripeSignature
});
function stripeSecretKey() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  return /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(key) ? key : null;
}
function requireKey() {
  const key = stripeSecretKey();
  if (!key) throw new Error("Stripe is not configured for this deployment.");
  return key;
}
function form(values) {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) if (value !== void 0) body.append(name, String(value));
  return body;
}
async function stripeRequest(path, init = {}) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${requireKey()}`,
      ...init.body ? { "content-type": "application/x-www-form-urlencoded" } : {},
      ...init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}
    },
    body: init.body,
    signal: AbortSignal.timeout(2e4)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Stripe request failed: ${payload?.error?.message ?? response.status}`);
  return payload;
}
function retrieveCheckoutSession(sessionId) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Checkout session is invalid.");
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.latest_charge`);
}
async function createPaymentFunction2({ trip, amount, currency, idempotencyKey, origin }) {
  if (!trip?.id || !trip.confirmationCode || !origin) throw new Error("Card payment needs the trip and the storefront origin.");
  const code = encodeURIComponent(trip.confirmationCode);
  const session2 = await stripeRequest("/checkout/sessions", {
    method: "POST",
    idempotencyKey: `trip-checkout:${idempotencyKey}`,
    body: form({
      mode: "payment",
      client_reference_id: trip.id,
      // Riders shouldn't retype the email they booked with.
      customer_email: typeof trip.rider?.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trip.rider.email) ? trip.rider.email : void 0,
      "metadata[tripId]": trip.id,
      "metadata[confirmationCode]": trip.confirmationCode,
      "payment_intent_data[metadata][tripId]": trip.id,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": String(currency).toLowerCase(),
      "line_items[0][price_data][unit_amount]": amount,
      "line_items[0][price_data][product_data][name]": `Ride ${trip.confirmationCode}`,
      success_url: `${origin}/rides/${code}?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/rides/${code}?checkout=cancelled`
    })
  });
  return { status: "pending", externalId: session2.id, url: session2.url, amount, currency };
}
async function capturePaymentFunction2({ paymentId }) {
  return getPaymentStatusFunction2({ paymentId });
}
async function getPaymentStatusFunction2({ paymentId }) {
  if (/^pi_[A-Za-z0-9]+$/.test(String(paymentId || ""))) {
    const intent = await retrievePaymentIntent(String(paymentId));
    return { status: intent.status === "succeeded" ? "captured" : intent.status === "canceled" ? "cancelled" : intent.status === "processing" ? "pending" : "failed", externalId: intent.id, amount: intent.amount, currency: intent.currency?.toUpperCase() };
  }
  const session2 = await retrieveCheckoutSession(String(paymentId || ""));
  const status = session2.payment_status === "paid" ? "captured" : session2.status === "expired" ? "cancelled" : "pending";
  return { status, externalId: session2.id, amount: session2.amount_total, currency: session2.currency?.toUpperCase() };
}
async function paymentIntentId(reference) {
  if (/^pi_[A-Za-z0-9]+$/.test(reference)) return reference;
  const session2 = await retrieveCheckoutSession(reference);
  return typeof session2.payment_intent === "string" ? session2.payment_intent : session2.payment_intent?.id ?? null;
}
function refundLateCheckout({ paymentIntentId: paymentIntentId2, paymentId }) {
  return stripeRequest("/refunds", {
    method: "POST",
    idempotencyKey: `late-checkout-refund:${paymentId}`,
    body: form({ payment_intent: paymentIntentId2, "metadata[paymentId]": paymentId, "metadata[reason]": "ride_closed_before_payment" })
  });
}
async function refundPaymentFunction2({ paymentId, amount, idempotencyKey }) {
  const intent = await paymentIntentId(String(paymentId || ""));
  if (!intent) throw new Error("This checkout has no payment to refund.");
  const refund = await stripeRequest("/refunds", {
    method: "POST",
    idempotencyKey: `trip-refund:${idempotencyKey}`,
    body: form({ payment_intent: intent, amount, "metadata[refundKey]": idempotencyKey })
  });
  return { status: refund.status === "succeeded" ? "succeeded" : "processing", externalId: refund.id, amount };
}
function createStripeCustomer({ email, name, userId }) {
  return stripeRequest("/customers", { method: "POST", idempotencyKey: `rider-customer:${userId}`, body: form({ email: email || void 0, name: name || void 0, "metadata[userId]": userId }) });
}
function createCardSetupSession({ customerId, userId, successUrl, cancelUrl }) {
  return stripeRequest("/checkout/sessions", { method: "POST", body: form({
    mode: "setup",
    customer: customerId,
    client_reference_id: userId,
    "payment_method_types[0]": "card",
    "metadata[userId]": userId,
    "metadata[purpose]": "rider_card",
    "setup_intent_data[metadata][userId]": userId,
    success_url: successUrl,
    cancel_url: cancelUrl
  }) });
}
function retrieveSetupSession(sessionId) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Card setup session is invalid.");
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=setup_intent.payment_method`);
}
function detachPaymentMethod(paymentMethodId) {
  if (!/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) throw new Error("Saved card is invalid.");
  return stripeRequest(`/payment_methods/${encodeURIComponent(paymentMethodId)}/detach`, { method: "POST", body: form({}) });
}
function retrievePaymentIntent(id) {
  if (!/^pi_[A-Za-z0-9]+$/.test(id)) throw new Error("Payment is invalid.");
  return stripeRequest(`/payment_intents/${encodeURIComponent(id)}`);
}
async function chargeSavedCard({ customerId, paymentMethodId, amount, currency, description, metadata, idempotencyKey }) {
  const body = form({
    amount,
    currency: currency.toLowerCase(),
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: "true",
    confirm: "true",
    description,
    ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`metadata[${key}]`, value]))
  });
  const response = await fetch(`${STRIPE_API}/payment_intents`, {
    method: "POST",
    headers: { authorization: `Bearer ${requireKey()}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": idempotencyKey },
    body,
    signal: AbortSignal.timeout(2e4)
  });
  const payload = await response.json().catch(() => null);
  if (response.ok) return payload;
  const failed = payload?.error?.payment_intent;
  if (payload?.error?.type === "card_error" && failed?.id) return { ...failed, last_payment_error: failed.last_payment_error || { code: payload.error.code, decline_code: payload.error.decline_code, message: payload.error.message } };
  throw new Error(`Stripe request failed: ${payload?.error?.message ?? response.status}`);
}
async function findRefundByKey(reference, refundKey) {
  const intent = await paymentIntentId(reference);
  if (!intent) return null;
  const list13 = await stripeRequest(`/refunds?payment_intent=${encodeURIComponent(intent)}&limit=100`);
  return list13.data.find((refund) => refund.metadata?.refundKey === refundKey) ?? null;
}
async function findSavedCardIntent(customerId, paymentId, attempt2, since) {
  const created = Math.floor(new Date(since).getTime() / 1e3) - 60;
  const list13 = await stripeRequest(`/payment_intents?customer=${encodeURIComponent(customerId)}&created[gte]=${created}&limit=100`);
  return list13.data.find((intent) => intent.metadata?.paymentId === paymentId && intent.metadata?.attempt === String(attempt2)) ?? null;
}
function retrieveRefund(id) {
  if (!/^re_[A-Za-z0-9]+$/.test(id)) throw new Error("Refund is invalid.");
  return stripeRequest(`/refunds/${encodeURIComponent(id)}`);
}
async function handleWebhookFunction2() {
  throw new Error("Stripe events arrive at /api/payment-webhooks/stripe.");
}
var STRIPE_API;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    init_stripeSignature();
    STRIPE_API = "https://api.stripe.com/v1";
  }
});

// features/keystone/domain/autoDispatchRanking.ts
var autoDispatchRanking_exports = {};
__export(autoDispatchRanking_exports, {
  LOCATION_FRESH_MS: () => LOCATION_FRESH_MS,
  coarsePoint: () => coarsePoint,
  distanceKm: () => distanceKm,
  freshLocation: () => freshLocation,
  rankDrivers: () => rankDrivers
});
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function freshLocation(driver, now) {
  if (driver.lastLocationLng == null || driver.lastLocationLat == null || !driver.lastLocationAt) return null;
  if (now.getTime() - driver.lastLocationAt.getTime() > LOCATION_FRESH_MS) return null;
  return [driver.lastLocationLng, driver.lastLocationLat];
}
function rankDrivers(candidates) {
  return [...candidates].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.driverId.localeCompare(b.driverId));
}
function coarsePoint(lng, lat) {
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return [Math.round(lng * 1e3) / 1e3, Math.round(lat * 1e3) / 1e3];
}
var LOCATION_FRESH_MS;
var init_autoDispatchRanking = __esm({
  "features/keystone/domain/autoDispatchRanking.ts"() {
    "use strict";
    LOCATION_FRESH_MS = 10 * 6e4;
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/lib/s3-storage.ts
function s3ForcePathStyle(endpoint) {
  let hostname = "";
  try {
    hostname = endpoint ? new URL(endpoint).hostname : "";
  } catch {
  }
  return !(hostname === "storageapi.dev" || hostname.endsWith(".storageapi.dev"));
}

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core14 = require("@keystone-6/core");
var import_session = require("@keystone-6/core/session");
var import_config = require("dotenv/config");

// features/keystone/models/PaymentObservation.ts
var import_core2 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
init_access();

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({ defaultValue: { kind: "now" }, isIndexed: true }),
  updatedAt: (0, import_fields.timestamp)({ db: { updatedAt: true }, isIndexed: true })
};

// features/keystone/models/labels.ts
var import_core = require("@keystone-6/core");
var import_fields2 = require("@keystone-6/core/fields");
var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var words = (value) => typeof value === "string" && value ? value.replaceAll("_", " ") : "";
var join = (...parts) => parts.filter((part) => typeof part === "string" && part).join(" \xB7 ");
var money = (minor, currency) => typeof minor === "number" && typeof currency === "string" && currency ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100) : "";
var shortDate = (value) => value instanceof Date || typeof value === "string" ? new Date(value).toISOString().slice(0, 10) : "";
async function driverName(context, id) {
  return typeof id === "string" ? (await context.prisma.driverProfile.findUnique({ where: { id }, select: { publicName: true } }))?.publicName || "" : "";
}
async function vehicleLabel(context, id) {
  return typeof id === "string" ? (await context.prisma.vehicle.findUnique({ where: { id }, select: { label: true } }))?.label || "" : "";
}
function recordLabel(resolve) {
  return (0, import_fields2.virtual)({
    field: import_core.graphql.field({ type: import_core.graphql.String, resolve: async (item, _args, context) => await resolve(item, context) || String(item.id) }),
    ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } }
  });
}
var labels = {
  fareSummary: (0, import_fields2.virtual)({
    field: import_core.graphql.field({ type: import_core.graphql.String, resolve: (item) => {
      const unit = item.distanceUnit === "kilometer" ? "km" : "mile";
      return [`${money(item.baseFareMinor, item.currencyCode)} base`, `${money(item.perDistanceUnitMinor, item.currencyCode)}/${unit}`, `${money(item.perMinuteMinor, item.currencyCode)}/min`, `${money(item.minimumFareMinor, item.currencyCode)} minimum`].join(" \xB7 ");
    } }),
    ui: { createView: { fieldMode: "hidden" } }
  }),
  fleetMembership: recordLabel(async (item, context) => {
    const user = typeof item.userId === "string" ? await context.prisma.user.findUnique({ where: { id: item.userId }, select: { name: true } }) : null;
    return join(user?.name, words(item.role));
  }),
  availabilityRule: recordLabel((item) => join(DAYS[item.dayOfWeek] || "", item.startTime && item.endTime ? `${item.startTime}\u2013${item.endTime}` : "", item.timezone)),
  availabilityException: recordLabel(async (item, context) => join(await driverName(context, item.driverId), words(item.kind), shortDate(item.startsAt))),
  complianceDocument: recordLabel(async (item, context) => join(await driverName(context, item.driverId) || await vehicleLabel(context, item.vehicleId), words(item.kind))),
  policyEvaluation: recordLabel(async (item, context) => join(await driverName(context, item.driverId) || await vehicleLabel(context, item.vehicleId), words(item.outcome))),
  marketplaceRegistration: recordLabel((item) => join(item.platform, words(item.status))),
  matchOffer: recordLabel(async (item, context) => join(await driverName(context, item.driverId), words(item.status))),
  payment: recordLabel((item) => join(money(item.amountMinor, item.currencyCode), words(item.status))),
  refund: recordLabel((item) => join("Refund", money(item.amountMinor, item.currencyCode), words(item.status))),
  ledgerEntry: recordLabel((item) => join(words(item.kind) || "Entry", money(item.amountMinor, item.currencyCode))),
  payout: recordLabel(async (item, context) => join(await driverName(context, item.driverId), money(item.amountMinor, item.currencyCode), words(item.status))),
  cancellation: recordLabel((item) => join("Cancellation", words(item.reasonCode), shortDate(item.createdAt))),
  locationEvent: recordLabel((item) => join(words(item.actorType), shortDate(item.recordedAt))),
  conversation: recordLabel((item) => join("Conversation", words(item.status))),
  message: recordLabel((item) => join(words(item.senderType), typeof item.body === "string" ? item.body.slice(0, 40) : "")),
  review: recordLabel((item) => join(typeof item.rating === "number" ? `${item.rating}/5` : "", words(item.direction))),
  notification: recordLabel((item) => join(words(item.channel), words(item.templateKey), words(item.status))),
  paymentObservation: recordLabel((item) => join("Observation", item.observationKey)),
  requestCancellationCommand: recordLabel((item) => join("Request cancellation", shortDate(item.createdAt))),
  fleetBrandingChange: recordLabel((item) => join("Branding change", shortDate(item.createdAt)))
};

// features/keystone/models/PaymentObservation.ts
var PaymentObservation = (0, import_core2.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["observationKey"] },
  access: financeAccess,
  fields: {
    label: labels.paymentObservation,
    payment: (0, import_fields3.relationship)({ ...relationFilter("Payment"), ref: "Payment", access: { create: () => false, update: () => false } }),
    refund: (0, import_fields3.relationship)({ ...relationFilter("Refund"), ref: "Refund", access: { create: () => false, update: () => false } }),
    observationKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    details: (0, import_fields3.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/RequestCancellationCommand.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
init_access();
var RequestCancellationCommand = (0, import_core3.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  fields: {
    label: labels.requestCancellationCommand,
    request: (0, import_fields4.relationship)({ ...relationFilter("RideRequest"), ref: "RideRequest", access: { create: () => false, update: () => false } }),
    idempotencyKey: (0, import_fields4.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    command: (0, import_fields4.json)({ defaultValue: {} }),
    result: (0, import_fields4.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/FleetBrandingChange.ts
var import_core4 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
init_access();
var FleetBrandingChange = (0, import_core4.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: lockedFleetAccess("fleetAdmin"),
  fields: {
    label: labels.fleetBrandingChange,
    fleet: (0, import_fields5.relationship)({ ...relationFilter("Fleet"), ref: "Fleet", access: { create: () => false, update: () => false } }),
    actor: (0, import_fields5.relationship)({ ...relationFilter("User"), ref: "User", access: { create: () => false, update: () => false } }),
    idempotencyKey: (0, import_fields5.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    command: (0, import_fields5.json)({ defaultValue: {} }),
    result: (0, import_fields5.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/User.ts
var import_core5 = require("@keystone-6/core");
var import_access4 = require("@keystone-6/core/access");
var import_fields6 = require("@keystone-6/core/fields");
init_access();

// features/keystone/domain/riderAccounts.ts
async function riderSignupsOpen(prisma) {
  if (process.env.PUBLIC_SIGNUPS_ALLOWED === "true") return true;
  return Boolean(await prisma.fleet.findFirst({ where: { riderAccounts: "open", status: "active" }, select: { id: true } }));
}

// features/keystone/models/User.ts
var selfOrPeople = async (args) => await permissions.canManagePeople(args) || (await isSignedIn(args) ? { id: { equals: args.session.itemId } } : false);
var selfField = async (args) => await permissions.canManagePeople(args) || await isSignedIn(args) && args.session.itemId === String(args.item.id);
async function firstUserAdminRole(context) {
  if (await context.prisma.user.count() > 0) return null;
  const grants = Object.fromEntries(permissionNames.map((name) => [name, true]));
  await context.prisma.role.upsert({ where: { name: "Admin" }, create: { name: "Admin", ...grants }, update: grants, select: { id: true } });
  const role = await context.prisma.role.findUnique({ where: { name: "Admin" }, select: { id: true } });
  if (!role?.id) throw new Error("The Admin role could not be created.");
  return role.id;
}
var User = (0, import_core5.list)({
  // The password is write-only (read: denyAll), so a list column would always read "not set".
  ui: { listView: { initialColumns: ["name", "email", "role", "onboardingStatus"] } },
  hooks: {
    resolveInput: async ({ operation, resolvedData, context }) => {
      if (operation !== "create" || resolvedData.role) return resolvedData;
      const roleId = await firstUserAdminRole(context);
      return roleId ? { ...resolvedData, role: { connect: { id: roleId } } } : resolvedData;
    }
  },
  access: {
    operation: { query: isSignedIn, create: async (args) => await riderSignupsOpen(args.context.prisma) || permissions.canManagePeople(args), update: isSignedIn, delete: import_access4.denyAll },
    filter: { query: selfOrPeople, update: selfOrPeople }
  },
  fields: {
    name: (0, import_fields6.text)({ validation: { isRequired: true } }),
    email: (0, import_fields6.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    password: (0, import_fields6.password)({ validation: { isRequired: true, length: { min: 10 } }, isFilterable: false, isOrderable: false, access: { read: import_access4.denyAll } }),
    phone: (0, import_fields6.text)({ isFilterable: permissions.canManagePeople, isOrderable: permissions.canManagePeople, access: { read: selfField, update: selfField } }),
    role: (0, import_fields6.relationship)({ ...relationFilter("Role"), ref: "Role.assignedTo", access: { create: permissions.canManageRoles, update: permissions.canManageRoles } }),
    onboardingStatus: (0, import_fields6.select)({ options: [
      { label: "Not started", value: "not_started" },
      { label: "In progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "Dismissed", value: "dismissed" }
    ], defaultValue: "not_started", access: { create: () => false, update: () => false } }),
    fleetMemberships: (0, import_fields6.relationship)({ ...relationFilter("FleetMembership"), ref: "FleetMembership.user", many: true, access: { create: () => false, update: () => false } }),
    driverProfile: (0, import_fields6.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.user", access: { create: () => false, update: () => false } }),
    riderProfile: (0, import_fields6.relationship)({ ...relationFilter("RiderProfile"), ref: "RiderProfile.user", access: { create: () => false, update: () => false } }),
    requestedRides: (0, import_fields6.relationship)({ ...relationFilter("RideRequest"), ref: "RideRequest.rider", many: true, access: { create: () => false, update: () => false } }),
    trips: (0, import_fields6.relationship)({ ...relationFilter("Trip"), ref: "Trip.rider", many: true, access: { create: () => false, update: () => false } }),
    reviews: (0, import_fields6.relationship)({ ...relationFilter("Review"), ref: "Review.author", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core6 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
init_access();
var Role = (0, import_core6.list)({
  access: { operation: { query: isSignedIn, create: permissions.canManageRoles, update: permissions.canManageRoles, delete: permissions.canManageRoles } },
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    ...Object.fromEntries(permissionNames.map((name) => [name, (0, import_fields7.checkbox)({ defaultValue: false })])),
    assignedTo: (0, import_fields7.relationship)({ ...relationFilter("User"), ref: "User.role", many: true, access: { create: permissions.canManageRoles, update: permissions.canManageRoles } }),
    ...trackingFields
  }
});

// features/keystone/models/Identity.ts
var import_core7 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var import_access7 = require("@keystone-6/core/access");
init_access();

// features/platform/settings/branding/store-logo.ts
var DEFAULT_STORE_LOGO_ICON = '<svg fill="none" height="100%" viewBox="0 0 42 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#155eef"><path d="m14.1061 19.6565c5.499-2.6299 9.8025-7.0929 12.2731-12.67168-1.5939-1.67362-3.666-2.86907-5.8975-3.58634l-1.1954-.39848c-.0797.15939-.1594.39849-.1594.55788-1.9127 5.41936-5.8178 9.80262-11.07766 12.27322-3.66599 1.7533-6.37564 4.9412-7.650763 8.7666l-.398477 1.1955c.159391.0797.39848.1593.557871.1593 1.514209.5579 3.028419 1.2752 4.462939 2.1519 1.99238-3.5864 5.18019-6.6148 9.08529-8.4479z"/><path d="m37.2173 19.9753c-2.9487 4.463-7.0132 8.0494-12.034 10.4403-4.0645 1.9127-7.1726 5.499-8.6071 9.8026l-.3985 1.3549c1.5142 1.3548 3.3472 2.3909 5.3396 3.0284l1.1955.3985c.0796-.1594.1593-.3985.1593-.5579 1.9127-5.4193 5.8178-9.8026 11.0777-12.2732 3.666-1.7533 6.4553-4.9412 7.6507-8.7666l.3985-1.1954c-1.6736-.4782-3.2675-1.2752-4.7817-2.2316z" opacity=".6"/><path d="m12.9903 37.4284c1.9924-4.7818 5.6584-8.6869 10.3604-10.9184 4.3035-2.0721 7.8898-5.26 10.3604-9.1651-1.833-1.7533-3.3472-3.7458-4.463-6.1366-2.9487 5.4193-7.571 9.8026-13.2294 12.5123-3.2675 1.5142-5.8974 4.1442-7.49136 7.3321 1.75326 1.6736 3.18786 3.7457 4.30356 6.0569 0 0 .0797.1594.1594.3188z" opacity=".8"/></g></svg>';
var DEFAULT_STORE_LOGO_COLOR = "314";
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}

// features/keystone/utils/storeLogo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) {
    return "";
  }
  if (/&|<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) {
    return "";
  }
  let tagCount = 0;
  const stack = [];
  let roots = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) {
      if (match[2].trim() || stack.pop() !== element) return "";
      continue;
    }
    if (!stack.length) {
      if (element !== "svg" || ++roots !== 1) return "";
    }
    if (!/\/\s*>$/.test(match[0])) stack.push(element);
    const attributes = match[2];
    let consumed = "";
    const attributesSeen = /* @__PURE__ */ new Set();
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (attributesSeen.has(attribute)) return "";
      attributesSeen.add(attribute);
      if (attribute === "xmlns" && value !== "http://www.w3.org/2000/svg") return "";
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || stack.length || roots !== 1 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/keystone/domain/fleetConfig.ts
function fleetConfigProblems(data) {
  const problems = [];
  if (data.timezone !== void 0) {
    const zone = String(data.timezone ?? "");
    let valid = Boolean(zone);
    try {
      if (valid) new Intl.DateTimeFormat("en-US", { timeZone: zone });
    } catch {
      valid = false;
    }
    if (!valid) problems.push("Time zone must be a real IANA zone, such as America/New_York.");
  }
  if (data.currencyCode !== void 0 && !/^[A-Z]{3}$/.test(String(data.currencyCode ?? ""))) problems.push("Currency must be a three-letter code in capitals, such as USD.");
  if (data.countryCode !== void 0 && !/^[A-Z]{2}$/.test(String(data.countryCode ?? ""))) problems.push("Country must be a two-letter code in capitals, such as US.");
  if (data.preciseLocationRetentionDays !== void 0) {
    const raw = String(data.preciseLocationRetentionDays ?? "");
    const days = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(days) || days < 1 || days > 3650) problems.push("Location retention must be a whole number of days from 1 to 3650.");
  }
  return problems;
}

// features/keystone/models/Identity.ts
var Fleet = (0, import_core7.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: fleetScopedAccess("fleetAdmin"),
  // Receipts format times in the fleet's zone, fares are in its currency and trip locations are kept for its
  // retention days; createFleet checks them, and so must any later edit, or receipts and location writes break.
  hooks: { validateInput: ({ resolvedData, addValidationError }) => {
    for (const message of fleetConfigProblems(resolvedData)) addValidationError(message);
  } },
  fields: {
    name: (0, import_fields8.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields8.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: (0, import_fields8.select)({ options: [{ label: "Setup", value: "setup" }, { label: "Active", value: "active" }, { label: "Paused", value: "paused" }], defaultValue: "setup" }),
    publicDescription: (0, import_fields8.text)({ ui: { displayMode: "textarea" } }),
    heroImage: (0, import_fields8.image)({ storage: "my_images", label: "Hero image", ui: { description: "Shown behind the rider home screen. Leave empty to show the map only." } }),
    publicCity: (0, import_fields8.text)(),
    countryCode: (0, import_fields8.text)({ defaultValue: "US" }),
    currencyCode: (0, import_fields8.text)({ defaultValue: "USD" }),
    timezone: (0, import_fields8.text)({ defaultValue: "UTC" }),
    supportEmail: (0, import_fields8.text)(),
    supportPhone: (0, import_fields8.text)(),
    logoIcon: (0, import_fields8.text)({ defaultValue: DEFAULT_STORE_LOGO_ICON, hooks: {
      resolveInput: ({ resolvedData, fieldKey }) => {
        const value = resolvedData[fieldKey];
        return value === void 0 || value === null || value === "" ? value : typeof value === "string" ? sanitizeStoreLogoSvg(value) : "";
      },
      validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
        if (typeof inputData?.[fieldKey] === "string" && inputData[fieldKey].trim() && !resolvedData?.[fieldKey]) addValidationError("Logo must be a safe SVG document.");
      }
    } }),
    logoColor: (0, import_fields8.text)({ defaultValue: DEFAULT_STORE_LOGO_COLOR, hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
    riderAccounts: (0, import_fields8.select)({ options: [{ label: "Closed", value: "closed" }, { label: "Open", value: "open" }], defaultValue: "closed", validation: { isRequired: true } }),
    operationsMode: (0, import_fields8.select)({ options: [{ label: "Off", value: "off" }, { label: "Manual dispatch", value: "manual" }, { label: "Auto dispatch", value: "auto" }], defaultValue: "off", validation: { isRequired: true }, ui: { description: "Auto dispatch offers each new ride to the nearest available driver, one at a time; operators can still offer rides by hand." } }),
    preciseLocationRetentionDays: (0, import_fields8.text)({ defaultValue: "30" }),
    memberships: (0, import_fields8.relationship)({ ...relationFilter("FleetMembership"), ref: "FleetMembership.fleet", many: true, access: { create: () => false, update: () => false } }),
    drivers: (0, import_fields8.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.fleet", many: true, access: { create: () => false, update: () => false } }),
    riders: (0, import_fields8.relationship)({ ...relationFilter("RiderProfile"), ref: "RiderProfile.homeFleet", many: true, access: { create: () => false, update: () => false } }),
    vehicles: (0, import_fields8.relationship)({ ...relationFilter("Vehicle"), ref: "Vehicle.fleet", many: true, access: { create: () => false, update: () => false } }),
    serviceAreas: (0, import_fields8.relationship)({ ...relationFilter("ServiceArea"), ref: "ServiceArea.fleet", many: true, access: { create: () => false, update: () => false } }),
    services: (0, import_fields8.relationship)({ ...relationFilter("RideService"), ref: "RideService.fleet", many: true, access: { create: () => false, update: () => false } }),
    fareRules: (0, import_fields8.relationship)({ ...relationFilter("FareRule"), ref: "FareRule.fleet", many: true, access: { create: () => false, update: () => false } }),
    rides: (0, import_fields8.relationship)({ ...relationFilter("RideRequest"), ref: "RideRequest.fleet", many: true, access: { create: () => false, update: () => false } }),
    trips: (0, import_fields8.relationship)({ ...relationFilter("Trip"), ref: "Trip.fleet", many: true, access: { create: () => false, update: () => false } }),
    policies: (0, import_fields8.relationship)({ ...relationFilter("Policy"), ref: "Policy.fleet", many: true, access: { create: () => false, update: () => false } }),
    providers: (0, import_fields8.relationship)({ ...relationFilter("ProviderConnection"), ref: "ProviderConnection.fleet", many: true, access: { create: () => false, update: () => false } }),
    marketplaceRegistration: (0, import_fields8.relationship)({ ...relationFilter("MarketplaceRegistration"), ref: "MarketplaceRegistration.fleet", access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var FleetMembership = (0, import_core7.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["role"] },
  access: lockedOperationalAccess,
  fields: {
    label: labels.fleetMembership,
    fleet: (0, import_fields8.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.memberships", access: { create: () => false, update: () => false } }),
    user: (0, import_fields8.relationship)({ ...relationFilter("User"), ref: "User.fleetMemberships", access: { create: () => false, update: () => false } }),
    role: (0, import_fields8.select)({ options: ["owner", "dispatcher", "support", "finance", "viewer"].map((value) => ({ label: value, value })), defaultValue: "viewer" }),
    status: (0, import_fields8.select)({ options: ["invited", "active", "suspended"].map((value) => ({ label: value, value })), defaultValue: "invited" }),
    invitedAt: (0, import_fields8.timestamp)(),
    acceptedAt: (0, import_fields8.timestamp)(),
    ...trackingFields
  }
});
var DriverProfile = (0, import_core7.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "publicName", searchFields: ["publicName"] },
  access: fleetScopedAccess("drivers"),
  fields: {
    user: (0, import_fields8.relationship)({ ...relationFilter("User"), ref: "User.driverProfile", access: { create: () => false, update: () => false } }),
    fleet: (0, import_fields8.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.drivers", access: { create: () => false, update: () => false } }),
    publicName: (0, import_fields8.text)({ validation: { isRequired: true } }),
    publicBio: (0, import_fields8.text)({ ui: { displayMode: "textarea" } }),
    publicPhotoUrl: (0, import_fields8.text)(),
    photo: (0, import_fields8.image)({ storage: "my_images", label: "Driver\u2019s own photo", ui: { description: "A photo the driver uploaded of themselves, shown to their rider on the trip card." } }),
    status: (0, import_fields8.select)({ options: ["applicant", "pending_review", "active", "paused", "ineligible", "offboarded"].map((value) => ({ label: value, value })), defaultValue: "applicant", access: { create: () => false, update: () => false } }),
    dispatchStatus: (0, import_fields8.select)({ options: ["offline", "available", "offered", "assigned", "on_trip"].map((value) => ({ label: value, value })), defaultValue: "offline", access: { create: () => false, update: () => false } }),
    // Where the driver last was while online, rounded to about 100 m. Auto-dispatch ranks drivers by it.
    lastLocationLng: (0, import_fields8.float)({ access: { create: () => false, update: () => false } }),
    lastLocationLat: (0, import_fields8.float)({ access: { create: () => false, update: () => false } }),
    lastLocationAt: (0, import_fields8.timestamp)({ access: { create: () => false, update: () => false } }),
    acceptsScheduled: (0, import_fields8.checkbox)({ defaultValue: true }),
    languages: (0, import_fields8.json)({ defaultValue: [] }),
    accessibilityTrainingEvidence: (0, import_fields8.text)(),
    documents: (0, import_fields8.relationship)({ ...relationFilter("ComplianceDocument"), ref: "ComplianceDocument.driver", many: true, access: { create: () => false, update: () => false } }),
    vehicles: (0, import_fields8.relationship)({ ...relationFilter("Vehicle"), ref: "Vehicle.drivers", many: true, access: { create: () => false, update: () => false } }),
    availabilityRules: (0, import_fields8.relationship)({ ...relationFilter("AvailabilityRule"), ref: "AvailabilityRule.driver", many: true, access: { create: () => false, update: () => false } }),
    availabilityExceptions: (0, import_fields8.relationship)({ ...relationFilter("AvailabilityException"), ref: "AvailabilityException.driver", many: true, access: { create: () => false, update: () => false } }),
    policyEvaluations: (0, import_fields8.relationship)({ ...relationFilter("PolicyEvaluation"), ref: "PolicyEvaluation.driver", many: true, access: { create: () => false, update: () => false } }),
    matchOffers: (0, import_fields8.relationship)({ ...relationFilter("MatchOffer"), ref: "MatchOffer.driver", many: true, access: { create: () => false, update: () => false } }),
    trips: (0, import_fields8.relationship)({ ...relationFilter("Trip"), ref: "Trip.driver", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var RiderProfile = (0, import_core7.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "displayName", searchFields: ["displayName"] },
  access: fleetScopedAccess("safety"),
  fields: {
    user: (0, import_fields8.relationship)({ ...relationFilter("User"), ref: "User.riderProfile", access: { create: () => false, update: () => false } }),
    homeFleet: (0, import_fields8.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.riders", access: { create: () => false, update: () => false } }),
    displayName: (0, import_fields8.text)({ validation: { isRequired: true } }),
    savedPlaces: (0, import_fields8.json)({ defaultValue: [], isFilterable: permissions.canManagePeople, isOrderable: permissions.canManagePeople, access: { read: permissions.canManagePeople, update: permissions.canManagePeople } }),
    accessibilityPreferences: (0, import_fields8.json)({ defaultValue: {} }),
    communicationPreferences: (0, import_fields8.json)({ defaultValue: {} }),
    emergencyContactEncryptedRef: (0, import_fields8.text)({ isFilterable: permissions.canManageSafety, isOrderable: permissions.canManageSafety, access: { read: permissions.canManageSafety, update: permissions.canManageSafety } }),
    // The rider's saved card (Stripe). Only the brand, last four and expiry are readable; the ids stay server-side.
    stripeCustomerId: (0, import_fields8.text)({ isFilterable: false, isOrderable: false, access: { read: import_access7.denyAll, create: () => false, update: () => false } }),
    cardPaymentMethodId: (0, import_fields8.text)({ isFilterable: false, isOrderable: false, access: { read: import_access7.denyAll, create: () => false, update: () => false } }),
    cardBrand: (0, import_fields8.text)({ access: { create: () => false, update: () => false } }),
    cardLast4: (0, import_fields8.text)({ access: { create: () => false, update: () => false } }),
    cardExpMonth: (0, import_fields8.integer)({ access: { create: () => false, update: () => false } }),
    cardExpYear: (0, import_fields8.integer)({ access: { create: () => false, update: () => false } }),
    cardSavedAt: (0, import_fields8.timestamp)({ access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Operations.ts
var import_core8 = require("@keystone-6/core");
var import_access9 = require("@keystone-6/core/access");
var import_fields9 = require("@keystone-6/core/fields");
init_access();
var documentAccess = lockedFleetAccess("drivers");
var Vehicle = (0, import_core8.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["label", "plateMasked"] },
  access: operatorAccess,
  fields: {
    fleet: (0, import_fields9.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.vehicles", access: { create: () => false, update: () => false } }),
    drivers: (0, import_fields9.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.vehicles", many: true, access: { create: () => false, update: () => false } }),
    label: (0, import_fields9.text)({ validation: { isRequired: true } }),
    make: (0, import_fields9.text)(),
    model: (0, import_fields9.text)(),
    year: (0, import_fields9.integer)(),
    color: (0, import_fields9.text)(),
    plateMasked: (0, import_fields9.text)(),
    plateEncryptedRef: (0, import_fields9.text)({ isFilterable: false, isOrderable: false, access: { read: import_access9.denyAll, create: permissions.canManageDrivers, update: permissions.canManageDrivers } }),
    vinEncryptedRef: (0, import_fields9.text)({ isFilterable: false, isOrderable: false, access: { read: import_access9.denyAll, create: permissions.canManageDrivers, update: permissions.canManageDrivers } }),
    capacity: (0, import_fields9.integer)({ defaultValue: 4, validation: { min: 1, max: 50 } }),
    wheelchairAccessible: (0, import_fields9.checkbox)({ defaultValue: false }),
    status: (0, import_fields9.select)({ options: ["pending_review", "active", "maintenance", "suspended", "retired"].map((value) => ({ label: value, value })), defaultValue: "pending_review", access: { create: () => false, update: () => false } }),
    documents: (0, import_fields9.relationship)({ ...relationFilter("ComplianceDocument"), ref: "ComplianceDocument.vehicle", many: true, access: { create: () => false, update: () => false } }),
    policyEvaluations: (0, import_fields9.relationship)({ ...relationFilter("PolicyEvaluation"), ref: "PolicyEvaluation.vehicle", many: true, access: { create: () => false, update: () => false } }),
    trips: (0, import_fields9.relationship)({ ...relationFilter("Trip"), ref: "Trip.vehicle", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var ComplianceDocument = (0, import_core8.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["issuer", "referenceMasked"] },
  access: documentAccess,
  fields: {
    label: labels.complianceDocument,
    driver: (0, import_fields9.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.documents", access: { create: () => false, update: () => false } }),
    vehicle: (0, import_fields9.relationship)({ ...relationFilter("Vehicle"), ref: "Vehicle.documents", access: { create: () => false, update: () => false } }),
    kind: (0, import_fields9.select)({ options: ["driver_license", "vehicle_registration", "insurance", "inspection", "background_check", "business_license", "other"].map((value) => ({ label: value, value })) }),
    status: (0, import_fields9.select)({ options: ["submitted", "under_review", "accepted_evidence", "rejected_evidence", "expired", "revoked"].map((value) => ({ label: value, value })), defaultValue: "submitted" }),
    issuer: (0, import_fields9.text)(),
    referenceMasked: (0, import_fields9.text)(),
    secureFileRef: (0, import_fields9.text)({ isFilterable: false, isOrderable: false, access: { read: import_access9.denyAll, create: permissions.canManageDrivers, update: permissions.canManageDrivers } }),
    issuedAt: (0, import_fields9.timestamp)(),
    expiresAt: (0, import_fields9.timestamp)(),
    reviewedAt: (0, import_fields9.timestamp)(),
    reviewer: (0, import_fields9.relationship)({ ...relationFilter("User"), ref: "User" }),
    reviewNotes: (0, import_fields9.text)({ ui: { displayMode: "textarea" } }),
    evidenceMetadata: (0, import_fields9.json)({ defaultValue: {}, isFilterable: permissions.canManageDrivers, isOrderable: permissions.canManageDrivers, access: { read: permissions.canManageDrivers, update: permissions.canManageDrivers } }),
    ...trackingFields
  }
});
var Policy = (0, import_core8.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: fleetScopedAccess("fleetAdmin"),
  fields: {
    fleet: (0, import_fields9.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.policies", access: { create: () => false, update: () => false } }),
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    version: (0, import_fields9.text)({ validation: { isRequired: true } }),
    jurisdiction: (0, import_fields9.text)(),
    kind: (0, import_fields9.select)({ options: ["driver_eligibility", "vehicle_eligibility", "insurance", "licensing", "background_check", "location_retention", "pricing", "cancellation"].map((value) => ({ label: value, value })) }),
    status: (0, import_fields9.select)({ options: ["draft", "active", "retired"].map((value) => ({ label: value, value })), defaultValue: "draft" }),
    requirements: (0, import_fields9.json)({ defaultValue: {} }),
    evidenceSources: (0, import_fields9.json)({ defaultValue: [] }),
    disclaimer: (0, import_fields9.text)({ defaultValue: "Evidence recording is not legal approval or a compliance certification.", ui: { displayMode: "textarea" } }),
    evaluations: (0, import_fields9.relationship)({ ...relationFilter("PolicyEvaluation"), ref: "PolicyEvaluation.policy", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var PolicyEvaluation = (0, import_core8.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: lockedFleetAccess("drivers"),
  fields: {
    label: labels.policyEvaluation,
    policy: (0, import_fields9.relationship)({ ...relationFilter("Policy"), ref: "Policy.evaluations" }),
    driver: (0, import_fields9.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.policyEvaluations" }),
    vehicle: (0, import_fields9.relationship)({ ...relationFilter("Vehicle"), ref: "Vehicle.policyEvaluations" }),
    outcome: (0, import_fields9.select)({ options: ["pending", "eligible", "ineligible", "manual_review"].map((value) => ({ label: value, value })), defaultValue: "pending" }),
    reasons: (0, import_fields9.json)({ defaultValue: [] }),
    evidenceSnapshot: (0, import_fields9.json)({ defaultValue: [] }),
    evaluatedAt: (0, import_fields9.timestamp)(),
    expiresAt: (0, import_fields9.timestamp)(),
    evaluator: (0, import_fields9.relationship)({ ...relationFilter("User"), ref: "User" }),
    ...trackingFields
  }
});
var ProviderConnection = (0, import_core8.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: fleetScopedAccess("fleetAdmin"),
  fields: {
    fleet: (0, import_fields9.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.providers", access: { create: () => false, update: () => false } }),
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    kind: (0, import_fields9.select)({ options: ["mapping", "payment", "communications", "identity", "background_check", "location", "notification"].map((value) => ({ label: value, value })) }),
    adapter: (0, import_fields9.text)({ validation: { isRequired: true } }),
    status: (0, import_fields9.select)({ options: ["unconfigured", "active", "disabled"].map((value) => ({ label: value, value })), defaultValue: "unconfigured" }),
    config: (0, import_fields9.json)({ defaultValue: {} }),
    secretReference: (0, import_fields9.text)({ isFilterable: false, isOrderable: false, access: { read: import_access9.denyAll } }),
    evidencePolicyUrl: (0, import_fields9.text)(),
    lastVerifiedAt: (0, import_fields9.timestamp)(),
    capabilities: (0, import_fields9.json)({ defaultValue: [] }),
    ...trackingFields
  }
});

// features/keystone/models/Service.ts
var import_core9 = require("@keystone-6/core");
var import_access11 = require("@keystone-6/core/access");
var import_fields10 = require("@keystone-6/core/fields");
init_access();

// features/lib/currency.ts
function currencyDigits(code) {
  if (typeof code !== "string" || !/^[A-Z]{3}$/.test(code)) throw new Error("Invalid currency.");
  const supported = Intl.supportedValuesOf?.("currency");
  if (supported && !supported.includes(code)) throw new Error("Unsupported currency.");
  return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
}
var MAX_MINOR = 2147483647;
function validMinor(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_MINOR;
}
function formatMoney(amountMinor, code) {
  try {
    if (!validMinor(amountMinor)) return "Amount unavailable";
    const digits = currencyDigits(code);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amountMinor / 10 ** digits);
  } catch {
    return "Amount unavailable";
  }
}

// features/keystone/domain/fare.ts
function fareRuleForValidation(item, resolvedData) {
  const changed = Object.fromEntries(Object.entries(resolvedData).filter(([, value]) => value !== void 0));
  return { ...item ?? {}, ...changed };
}
function validateFareRule(rule) {
  currencyDigits(rule.currencyCode);
  for (const key of ["baseFareMinor", "perDistanceUnitMinor", "perMinuteMinor", "bookingFeeMinor", "minimumFareMinor", "cancellationFeeMinor", "noShowFeeMinor"]) {
    if ((rule[key] !== void 0 || !["cancellationFeeMinor", "noShowFeeMinor"].includes(key)) && !validMinor(rule[key])) throw new Error("Fare components must be non-negative integer minor units within the supported range.");
  }
  if (!["mile", "kilometer"].includes(rule.distanceUnit)) throw new Error("Unsupported distance unit.");
  if (rule.version !== void 0 && (!Number.isSafeInteger(rule.version) || rule.version < 1)) throw new Error("Fare version must be positive.");
  const maximum = rule.maximumMultiplierBasisPoints ?? 1e4;
  const multiplier = rule.multiplierBasisPoints ?? 1e4;
  if (![maximum, multiplier].every((value) => Number.isSafeInteger(value) && value >= 1e4 && value <= 3e4) || multiplier > maximum) throw new Error("Invalid fare multiplier.");
}
function calculateFare(rule, distanceMeters, durationSeconds) {
  validateFareRule(rule);
  if (!Number.isSafeInteger(distanceMeters) || distanceMeters < 0 || distanceMeters > MAX_MINOR || !Number.isSafeInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > MAX_MINOR) throw new Error("Route estimates must be non-negative supported integers.");
  const divisor = rule.distanceUnit === "mile" ? 1609.344 : 1e3;
  const distanceMinor = Math.round(distanceMeters / divisor * rule.perDistanceUnitMinor);
  const durationMinor = Math.round(durationSeconds / 60 * rule.perMinuteMinor);
  const subtotalMinor = rule.baseFareMinor + distanceMinor + durationMinor + rule.bookingFeeMinor;
  const multiplier = rule.multiplierBasisPoints ?? 1e4;
  const totalMinor = Math.max(rule.minimumFareMinor, Math.round(subtotalMinor * multiplier / 1e4));
  if (![distanceMinor, durationMinor, subtotalMinor, totalMinor].every(validMinor) || !Number.isSafeInteger(subtotalMinor * multiplier)) throw new Error("Calculated fare exceeds the supported range.");
  return { currencyCode: rule.currencyCode, baseFareMinor: rule.baseFareMinor, distanceMinor, durationMinor, bookingFeeMinor: rule.bookingFeeMinor, multiplierBasisPoints: multiplier, subtotalMinor, totalMinor };
}

// features/keystone/models/Service.ts
var ServiceArea = (0, import_core9.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: operatorAccess,
  fields: {
    fleet: (0, import_fields10.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.serviceAreas", access: { create: () => false, update: () => false } }),
    name: (0, import_fields10.text)({ validation: { isRequired: true } }),
    publicRegionLabel: (0, import_fields10.text)({ validation: { isRequired: true } }),
    countryCode: (0, import_fields10.text)({ defaultValue: "US" }),
    status: (0, import_fields10.select)({ options: ["draft", "active", "paused"].map((value) => ({ label: value, value })), defaultValue: "draft" }),
    coarseBounds: (0, import_fields10.json)({ defaultValue: {} }),
    providerGeometryRef: (0, import_fields10.text)({ isFilterable: false, isOrderable: false, access: { read: import_access11.denyAll, create: permissions.canManageFleet, update: permissions.canManageFleet } }),
    services: (0, import_fields10.relationship)({ ...relationFilter("RideService"), ref: "RideService.serviceAreas", many: true, access: { create: () => false, update: () => false } }),
    fareRules: (0, import_fields10.relationship)({ ...relationFilter("FareRule"), ref: "FareRule.serviceArea", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var RideService = (0, import_core9.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: operatorAccess,
  fields: {
    fleet: (0, import_fields10.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.services", access: { create: () => false, update: () => false } }),
    name: (0, import_fields10.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields10.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    photo: (0, import_fields10.image)({ storage: "my_images", label: "Vehicle photo", ui: { description: "For your records. Riders see the matching drawing from the built-in vehicle set (by category), so every ride option looks the same." } }),
    description: (0, import_fields10.text)({ ui: { displayMode: "textarea" } }),
    status: (0, import_fields10.select)({ options: ["draft", "active", "paused"].map((value) => ({ label: value, value })), defaultValue: "draft" }),
    category: (0, import_fields10.select)({ options: ["standard", "comfort", "xl", "accessible", "pet_friendly", "scheduled"].map((value) => ({ label: value, value })), defaultValue: "standard" }),
    passengerCapacity: (0, import_fields10.integer)({ defaultValue: 4, validation: { min: 1, max: 50 } }),
    wheelchairAccessible: (0, import_fields10.checkbox)({ defaultValue: false }),
    advanceBookingMinutes: (0, import_fields10.integer)({ defaultValue: 0 }),
    serviceAreas: (0, import_fields10.relationship)({ ...relationFilter("ServiceArea"), ref: "ServiceArea.services", many: true, access: { create: () => false, update: () => false } }),
    fareRules: (0, import_fields10.relationship)({ ...relationFilter("FareRule"), ref: "FareRule.service", many: true, access: { create: () => false, update: () => false } }),
    quotes: (0, import_fields10.relationship)({ ...relationFilter("RideQuote"), ref: "RideQuote.service", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var AvailabilityRule = (0, import_core9.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["timezone"] },
  access: lockedOperationalAccess,
  fields: {
    label: labels.availabilityRule,
    driver: (0, import_fields10.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.availabilityRules" }),
    dayOfWeek: (0, import_fields10.integer)({ label: "Day (0 Sunday \u2013 6 Saturday)", validation: { min: 0, max: 6 } }),
    startTime: (0, import_fields10.text)(),
    endTime: (0, import_fields10.text)(),
    timezone: (0, import_fields10.text)({ defaultValue: "UTC" }),
    effectiveFrom: (0, import_fields10.timestamp)(),
    effectiveUntil: (0, import_fields10.timestamp)(),
    status: (0, import_fields10.select)({ options: ["active", "paused"].map((value) => ({ label: value, value })), defaultValue: "active" }),
    ...trackingFields
  }
});
var AvailabilityException = (0, import_core9.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["reason"] },
  access: lockedOperationalAccess,
  fields: {
    label: labels.availabilityException,
    driver: (0, import_fields10.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.availabilityExceptions" }),
    startsAt: (0, import_fields10.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields10.timestamp)({ validation: { isRequired: true } }),
    kind: (0, import_fields10.select)({ options: ["available", "blocked"].map((value) => ({ label: value, value })), defaultValue: "blocked" }),
    reason: (0, import_fields10.text)(),
    ...trackingFields
  }
});
var FareRule = (0, import_core9.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: fleetScopedAccess("fleetAdmin"),
  hooks: { validateInput: ({ resolvedData, item, addValidationError }) => {
    try {
      validateFareRule(fareRuleForValidation(item, resolvedData));
    } catch {
      addValidationError("Check the fare currency, version, multiplier and non-negative minor-unit amounts.");
    }
  } },
  fields: {
    fleet: (0, import_fields10.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.fareRules", access: { create: () => false, update: () => false } }),
    service: (0, import_fields10.relationship)({ ...relationFilter("RideService"), ref: "RideService.fareRules", access: { create: () => false, update: () => false } }),
    serviceArea: (0, import_fields10.relationship)({ ...relationFilter("ServiceArea"), ref: "ServiceArea.fareRules", access: { create: () => false, update: () => false } }),
    name: (0, import_fields10.text)({ validation: { isRequired: true } }),
    version: (0, import_fields10.integer)({ defaultValue: 1 }),
    status: (0, import_fields10.select)({ options: ["draft", "active", "retired"].map((value) => ({ label: value, value })), defaultValue: "draft" }),
    fareSummary: labels.fareSummary,
    currencyCode: (0, import_fields10.text)({ defaultValue: "USD" }),
    baseFareMinor: (0, import_fields10.integer)({ label: "Base fare (cents)", defaultValue: 0 }),
    perDistanceUnitMinor: (0, import_fields10.integer)({ label: "Per distance unit (cents)", defaultValue: 0 }),
    distanceUnit: (0, import_fields10.select)({ options: ["kilometer", "mile"].map((value) => ({ label: value, value })), defaultValue: "mile" }),
    perMinuteMinor: (0, import_fields10.integer)({ label: "Per minute (cents)", defaultValue: 0 }),
    bookingFeeMinor: (0, import_fields10.integer)({ label: "Booking fee (cents)", defaultValue: 0 }),
    minimumFareMinor: (0, import_fields10.integer)({ label: "Minimum fare (cents)", defaultValue: 0 }),
    cancellationFeeMinor: (0, import_fields10.integer)({ label: "Cancellation fee (cents)", defaultValue: 0 }),
    noShowFeeMinor: (0, import_fields10.integer)({ label: "No-show fee (cents)", defaultValue: 0 }),
    maximumMultiplierBasisPoints: (0, import_fields10.integer)({ defaultValue: 1e4, validation: { min: 1e4, max: 3e4 } }),
    rules: (0, import_fields10.json)({ defaultValue: {} }),
    quotes: (0, import_fields10.relationship)({ ...relationFilter("RideQuote"), ref: "RideQuote.fareRule", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var RideQuote = (0, import_core9.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "publicId", searchFields: ["publicId", "pickupLabel", "dropoffLabel"] },
  access: lockedOperationalAccess,
  fields: {
    service: (0, import_fields10.relationship)({ ...relationFilter("RideService"), ref: "RideService.quotes", access: { create: () => false, update: () => false } }),
    fareRule: (0, import_fields10.relationship)({ ...relationFilter("FareRule"), ref: "FareRule.quotes", access: { create: () => false, update: () => false } }),
    publicId: (0, import_fields10.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    handoffId: (0, import_fields10.text)({ isIndexed: true }),
    status: (0, import_fields10.select)({ options: ["active", "accepted", "expired", "void"].map((value) => ({ label: value, value })), defaultValue: "active" }),
    pickupLabel: (0, import_fields10.text)(),
    dropoffLabel: (0, import_fields10.text)(),
    routeInputHash: (0, import_fields10.text)({ isFilterable: false, isOrderable: false, access: { read: import_access11.denyAll } }),
    routeEvidence: (0, import_fields10.json)({ defaultValue: {} }),
    estimatedDistanceMeters: (0, import_fields10.integer)(),
    estimatedDurationSeconds: (0, import_fields10.integer)(),
    fareSnapshot: (0, import_fields10.json)({ defaultValue: {} }),
    totalMinor: (0, import_fields10.integer)({ validation: { min: 0 } }),
    currencyCode: (0, import_fields10.text)(),
    scheduledFor: (0, import_fields10.timestamp)(),
    expiresAt: (0, import_fields10.timestamp)({ validation: { isRequired: true } }),
    guestProofHash: (0, import_fields10.text)({ isFilterable: false, isOrderable: false, access: { read: import_access11.denyAll } }),
    rider: (0, import_fields10.relationship)({ ...relationFilter("User"), ref: "User", access: { create: () => false, update: () => false } }),
    request: (0, import_fields10.relationship)({ ...relationFilter("RideRequest"), ref: "RideRequest.quote", access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});

// features/keystone/models/Ride.ts
var import_core10 = require("@keystone-6/core");
var import_access13 = require("@keystone-6/core/access");
var import_fields11 = require("@keystone-6/core/fields");
init_access();
var RideRequest = (0, import_core10.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "requestNumber", searchFields: ["requestNumber", "pickupLabel", "dropoffLabel"] },
  access: lockedOperationalAccess,
  fields: {
    fleet: (0, import_fields11.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.rides", access: { create: () => false, update: () => false } }),
    rider: (0, import_fields11.relationship)({ ...relationFilter("User"), ref: "User.requestedRides", access: { create: () => false, update: () => false } }),
    quote: (0, import_fields11.relationship)({ ...relationFilter("RideQuote"), ref: "RideQuote.request", access: { create: () => false, update: () => false } }),
    requestNumber: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    status: (0, import_fields11.select)({ options: ["requested", "matching", "matched", "cancelled", "expired"].map((value) => ({ label: value, value })), defaultValue: "requested" }),
    requestedFor: (0, import_fields11.timestamp)(),
    passengerCount: (0, import_fields11.integer)({ defaultValue: 1, validation: { min: 1, max: 50 } }),
    accessibilityNeeds: (0, import_fields11.json)({ defaultValue: {} }),
    riderNotes: (0, import_fields11.text)({ ui: { displayMode: "textarea" } }),
    pickupLabel: (0, import_fields11.text)(),
    dropoffLabel: (0, import_fields11.text)(),
    preciseRouteEncryptedRef: (0, import_fields11.text)({ isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll } }),
    quoteSnapshot: (0, import_fields11.json)({ defaultValue: {} }),
    guestProofHash: (0, import_fields11.text)({ isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll } }),
    guestProofExpiresAt: (0, import_fields11.timestamp)(),
    matchOffers: (0, import_fields11.relationship)({ ...relationFilter("MatchOffer"), ref: "MatchOffer.request", many: true, access: { create: () => false, update: () => false } }),
    trip: (0, import_fields11.relationship)({ ...relationFilter("Trip"), ref: "Trip.request", access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var MatchOffer = (0, import_core10.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: lockedOperationalAccess,
  fields: {
    label: labels.matchOffer,
    request: (0, import_fields11.relationship)({ ...relationFilter("RideRequest"), ref: "RideRequest.matchOffers", access: { create: () => false, update: () => false } }),
    driver: (0, import_fields11.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.matchOffers", access: { create: () => false, update: () => false } }),
    vehicle: (0, import_fields11.relationship)({ ...relationFilter("Vehicle"), ref: "Vehicle", access: { create: () => false, update: () => false } }),
    status: (0, import_fields11.select)({ options: ["offered", "accepted", "declined", "expired", "withdrawn"].map((value) => ({ label: value, value })), defaultValue: "offered" }),
    offeredAt: (0, import_fields11.timestamp)({ defaultValue: { kind: "now" } }),
    reservationStartAt: (0, import_fields11.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" }, isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll, create: () => false, update: () => false } }),
    reservationReleasedAt: (0, import_fields11.timestamp)({ isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll, create: () => false, update: () => false } }),
    expiresAt: (0, import_fields11.timestamp)({ validation: { isRequired: true } }),
    respondedAt: (0, import_fields11.timestamp)(),
    declineReason: (0, import_fields11.text)(),
    idempotencyKey: (0, import_fields11.text)({ isIndexed: "unique", isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll } }),
    eligibilitySnapshot: (0, import_fields11.json)({ defaultValue: {} }),
    acceptedTrip: (0, import_fields11.relationship)({ ...relationFilter("Trip"), ref: "Trip.acceptedOffer", access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var Trip = (0, import_core10.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "confirmationCode", searchFields: ["confirmationCode", "pickupLabel", "dropoffLabel"] },
  access: lockedOperationalAccess,
  fields: {
    fleet: (0, import_fields11.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.trips", access: { create: () => false, update: () => false } }),
    request: (0, import_fields11.relationship)({ ...relationFilter("RideRequest"), ref: "RideRequest.trip", db: { foreignKey: { map: "request" } }, access: { create: () => false, update: () => false } }),
    acceptedOffer: (0, import_fields11.relationship)({ ...relationFilter("MatchOffer"), ref: "MatchOffer.acceptedTrip", db: { foreignKey: { map: "acceptedOffer" } }, access: { create: () => false, update: () => false } }),
    rider: (0, import_fields11.relationship)({ ...relationFilter("User"), ref: "User.trips", access: { create: () => false, update: () => false } }),
    driver: (0, import_fields11.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile.trips", access: { create: () => false, update: () => false } }),
    vehicle: (0, import_fields11.relationship)({ ...relationFilter("Vehicle"), ref: "Vehicle.trips", access: { create: () => false, update: () => false } }),
    confirmationCode: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    status: (0, import_fields11.select)({ options: ["driver_assigned", "driver_en_route", "driver_arrived", "in_progress", "completed", "cancelled", "no_show"].map((value) => ({ label: value, value })), defaultValue: "driver_assigned" }),
    scheduledFor: (0, import_fields11.timestamp)(),
    acceptedAt: (0, import_fields11.timestamp)(),
    enRouteAt: (0, import_fields11.timestamp)(),
    arrivedAt: (0, import_fields11.timestamp)(),
    startedAt: (0, import_fields11.timestamp)(),
    completedAt: (0, import_fields11.timestamp)(),
    cancelledAt: (0, import_fields11.timestamp)(),
    pickupLabel: (0, import_fields11.text)(),
    dropoffLabel: (0, import_fields11.text)(),
    bookingSnapshot: (0, import_fields11.json)({ defaultValue: {} }),
    finalFareSnapshot: (0, import_fields11.json)(),
    managementTokenHash: (0, import_fields11.text)({ isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll } }),
    managementTokenExpiresAt: (0, import_fields11.timestamp)(),
    managementTokenRevokedAt: (0, import_fields11.timestamp)(),
    events: (0, import_fields11.relationship)({ ...relationFilter("TripEvent"), ref: "TripEvent.trip", many: true, access: { create: () => false, update: () => false } }),
    locationEvents: (0, import_fields11.relationship)({ ...relationFilter("LocationEvent"), ref: "LocationEvent.trip", many: true, access: { create: () => false, update: () => false } }),
    cancellations: (0, import_fields11.relationship)({ ...relationFilter("Cancellation"), ref: "Cancellation.trip", many: true, access: { create: () => false, update: () => false } }),
    payments: (0, import_fields11.relationship)({ ...relationFilter("Payment"), ref: "Payment.trip", many: true, access: { create: () => false, update: () => false } }),
    ledgerEntries: (0, import_fields11.relationship)({ ...relationFilter("LedgerEntry"), ref: "LedgerEntry.trip", many: true, access: { create: () => false, update: () => false } }),
    incidents: (0, import_fields11.relationship)({ ...relationFilter("SafetyIncident"), ref: "SafetyIncident.trip", many: true, access: { create: () => false, update: () => false } }),
    supportCases: (0, import_fields11.relationship)({ ...relationFilter("SupportCase"), ref: "SupportCase.trip", many: true, access: { create: () => false, update: () => false } }),
    conversation: (0, import_fields11.relationship)({ ...relationFilter("Conversation"), ref: "Conversation.trip", access: { create: () => false, update: () => false } }),
    reviews: (0, import_fields11.relationship)({ ...relationFilter("Review"), ref: "Review.trip", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var TripEvent = (0, import_core10.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "eventType", searchFields: ["eventType", "toStatus"] },
  access: lockedOperationalAccess,
  fields: {
    trip: (0, import_fields11.relationship)({ ...relationFilter("Trip"), ref: "Trip.events", access: { create: () => false, update: () => false } }),
    eventType: (0, import_fields11.text)({ validation: { isRequired: true } }),
    fromStatus: (0, import_fields11.text)(),
    toStatus: (0, import_fields11.text)(),
    actorType: (0, import_fields11.select)({ options: ["rider", "driver", "operator", "provider", "system"].map((value) => ({ label: value, value })) }),
    actorUser: (0, import_fields11.relationship)({ ...relationFilter("User"), ref: "User", access: { create: () => false, update: () => false } }),
    idempotencyKey: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    occurredAt: (0, import_fields11.timestamp)({ defaultValue: { kind: "now" } }),
    metadata: (0, import_fields11.json)({ defaultValue: {} }),
    ...trackingFields
  }
});
var LocationEvent = (0, import_core10.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: { ...lockedOperationalAccess, filter: { ...lockedOperationalAccess.filter, query: async (args) => {
    const scope = await lockedOperationalAccess.filter.query(args);
    return scope === false ? false : { AND: [...scope === true ? [] : [scope], { expiresAt: { gt: (/* @__PURE__ */ new Date()).toISOString() } }] };
  } } },
  fields: {
    label: labels.locationEvent,
    trip: (0, import_fields11.relationship)({ ...relationFilter("Trip"), ref: "Trip.locationEvents", access: { create: () => false, update: () => false } }),
    actorType: (0, import_fields11.select)({ options: ["driver", "rider", "operator", "provider"].map((value) => ({ label: value, value })) }),
    recordedAt: (0, import_fields11.timestamp)({ validation: { isRequired: true } }),
    coarseGeohash: (0, import_fields11.text)(),
    encryptedCoordinateRef: (0, import_fields11.text)({ isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll } }),
    accuracyMeters: (0, import_fields11.integer)(),
    providerEvidence: (0, import_fields11.json)({ defaultValue: {}, isFilterable: false, isOrderable: false, access: { read: import_access13.denyAll } }),
    expiresAt: (0, import_fields11.timestamp)(),
    ...trackingFields
  }
});
var Cancellation = (0, import_core10.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["reasonCode"] },
  access: lockedOperationalAccess,
  fields: {
    label: labels.cancellation,
    trip: (0, import_fields11.relationship)({ ...relationFilter("Trip"), ref: "Trip.cancellations", access: { create: () => false, update: () => false } }),
    actorType: (0, import_fields11.select)({ options: ["rider", "driver", "operator", "system"].map((value) => ({ label: value, value })) }),
    reasonCode: (0, import_fields11.text)(),
    reason: (0, import_fields11.text)(),
    policySnapshot: (0, import_fields11.json)({ defaultValue: {} }),
    feeMinor: (0, import_fields11.integer)({ defaultValue: 0 }),
    currencyCode: (0, import_fields11.text)(),
    refundRequired: (0, import_fields11.select)({ options: ["no", "partial", "full", "manual_review"].map((value) => ({ label: value, value })), defaultValue: "no" }),
    ...trackingFields
  }
});

// features/keystone/models/Safety.ts
var import_core11 = require("@keystone-6/core");
var import_access15 = require("@keystone-6/core/access");
var import_fields12 = require("@keystone-6/core/fields");
init_access();
var SafetyIncident = (0, import_core11.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "caseNumber", searchFields: ["caseNumber", "summary"] },
  access: lockedFleetAccess("safety"),
  fields: {
    trip: (0, import_fields12.relationship)({ ...relationFilter("Trip"), ref: "Trip.incidents", access: { create: () => false, update: () => false } }),
    caseNumber: (0, import_fields12.text)({ isIndexed: "unique" }),
    severity: (0, import_fields12.select)({ options: ["low", "medium", "high", "critical"].map((value) => ({ label: value, value })), defaultValue: "medium" }),
    status: (0, import_fields12.select)({ options: ["open", "triage", "investigating", "resolved", "closed"].map((value) => ({ label: value, value })), defaultValue: "open" }),
    category: (0, import_fields12.text)(),
    summary: (0, import_fields12.text)(),
    restrictedDetails: (0, import_fields12.json)({ defaultValue: {}, isFilterable: safetyAccess.operation.query, isOrderable: safetyAccess.operation.query, access: { read: safetyAccess.operation.query, update: safetyAccess.operation.update } }),
    evidenceRefs: (0, import_fields12.json)({ defaultValue: [] }),
    reportedBy: (0, import_fields12.relationship)({ ...relationFilter("User"), ref: "User" }),
    assignedTo: (0, import_fields12.relationship)({ ...relationFilter("User"), ref: "User" }),
    reportedAt: (0, import_fields12.timestamp)({ defaultValue: { kind: "now" } }),
    resolvedAt: (0, import_fields12.timestamp)(),
    ...trackingFields
  }
});
var SupportCase = (0, import_core11.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "caseNumber", searchFields: ["caseNumber"] },
  access: lockedFleetAccess("safety"),
  fields: {
    trip: (0, import_fields12.relationship)({ ...relationFilter("Trip"), ref: "Trip.supportCases", access: { create: () => false, update: () => false } }),
    caseNumber: (0, import_fields12.text)({ isIndexed: "unique" }),
    status: (0, import_fields12.select)({ options: ["open", "waiting", "resolved", "closed"].map((value) => ({ label: value, value })), defaultValue: "open" }),
    category: (0, import_fields12.text)(),
    subject: (0, import_fields12.text)(),
    description: (0, import_fields12.text)({ ui: { displayMode: "textarea" } }),
    priority: (0, import_fields12.select)({ options: ["low", "normal", "high", "urgent"].map((value) => ({ label: value, value })), defaultValue: "normal" }),
    requester: (0, import_fields12.relationship)({ ...relationFilter("User"), ref: "User" }),
    assignedTo: (0, import_fields12.relationship)({ ...relationFilter("User"), ref: "User" }),
    resolvedAt: (0, import_fields12.timestamp)(),
    ...trackingFields
  }
});
var Conversation = (0, import_core11.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: lockedOperationalAccess,
  fields: { label: labels.conversation, trip: (0, import_fields12.relationship)({ ...relationFilter("Trip"), ref: "Trip.conversation", access: { create: () => false, update: () => false } }), status: (0, import_fields12.select)({ options: ["open", "closed", "blocked"].map((value) => ({ label: value, value })), defaultValue: "open" }), messages: (0, import_fields12.relationship)({ ...relationFilter("Message"), ref: "Message.conversation", many: true, access: { create: () => false, update: () => false } }), ...trackingFields }
});
var Message = (0, import_core11.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: lockedOperationalAccess,
  fields: {
    label: labels.message,
    conversation: (0, import_fields12.relationship)({ ...relationFilter("Conversation"), ref: "Conversation.messages", access: { create: () => false, update: () => false } }),
    senderType: (0, import_fields12.select)({ options: ["rider", "driver", "operator", "system"].map((value) => ({ label: value, value })) }),
    sender: (0, import_fields12.relationship)({ ...relationFilter("User"), ref: "User", access: { create: () => false, update: () => false } }),
    body: (0, import_fields12.text)({ ui: { displayMode: "textarea" } }),
    relayProviderReference: (0, import_fields12.text)({ isFilterable: false, isOrderable: false, access: { read: import_access15.denyAll } }),
    status: (0, import_fields12.select)({ options: ["queued", "sent", "delivered", "failed", "blocked"].map((value) => ({ label: value, value })), defaultValue: "queued" }),
    sentAt: (0, import_fields12.timestamp)(),
    metadata: (0, import_fields12.json)({ defaultValue: {} }),
    ...trackingFields
  }
});
var Review = (0, import_core11.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: lockedOperationalAccess,
  fields: {
    label: labels.review,
    trip: (0, import_fields12.relationship)({ ...relationFilter("Trip"), ref: "Trip.reviews", access: { create: () => false, update: () => false } }),
    author: (0, import_fields12.relationship)({ ...relationFilter("User"), ref: "User.reviews", access: { create: () => false, update: () => false } }),
    direction: (0, import_fields12.select)({ options: ["rider_to_driver", "driver_to_rider"].map((value) => ({ label: value, value })) }),
    rating: (0, import_fields12.integer)({ validation: { min: 1, max: 5 } }),
    body: (0, import_fields12.text)({ ui: { displayMode: "textarea" } }),
    status: (0, import_fields12.select)({ options: ["pending", "published", "hidden", "removed"].map((value) => ({ label: value, value })), defaultValue: "pending" }),
    submittedAt: (0, import_fields12.timestamp)({ defaultValue: { kind: "now" } }),
    moderatedAt: (0, import_fields12.timestamp)(),
    moderationReason: (0, import_fields12.text)(),
    ...trackingFields
  }
});

// features/keystone/models/Finance.ts
var import_core12 = require("@keystone-6/core");
var import_access17 = require("@keystone-6/core/access");
var import_fields13 = require("@keystone-6/core/fields");
init_access();
var PaymentProvider = (0, import_core12.list)({
  access: { operation: { query: permissions.canManageFinance, create: permissions.canManageIntegrations, update: permissions.canManageIntegrations, delete: permissions.canManageIntegrations } },
  fields: {
    name: (0, import_fields13.text)({ validation: { isRequired: true } }),
    code: (0, import_fields13.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    isInstalled: (0, import_fields13.select)({ options: [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }], defaultValue: "no" }),
    credentialsReference: (0, import_fields13.text)({ isFilterable: false, isOrderable: false, access: { read: import_access17.denyAll } }),
    metadata: (0, import_fields13.json)({ defaultValue: {} }),
    createPaymentFunction: (0, import_fields13.text)({ validation: { isRequired: true } }),
    capturePaymentFunction: (0, import_fields13.text)({ validation: { isRequired: true } }),
    refundPaymentFunction: (0, import_fields13.text)({ validation: { isRequired: true } }),
    getPaymentStatusFunction: (0, import_fields13.text)({ validation: { isRequired: true } }),
    handleWebhookFunction: (0, import_fields13.text)({ validation: { isRequired: true } }),
    payments: (0, import_fields13.relationship)({ ...relationFilter("Payment"), ref: "Payment.provider", many: true, access: { create: () => false, update: () => false } }),
    refunds: (0, import_fields13.relationship)({ ...relationFilter("Refund"), ref: "Refund.provider", many: true, access: { create: () => false, update: () => false } }),
    payouts: (0, import_fields13.relationship)({ ...relationFilter("Payout"), ref: "Payout.provider", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var Payment = (0, import_core12.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["providerReference"] },
  access: financeAccess,
  fields: {
    label: labels.payment,
    trip: (0, import_fields13.relationship)({ ...relationFilter("Trip"), ref: "Trip.payments", access: { create: () => false, update: () => false } }),
    provider: (0, import_fields13.relationship)({ ...relationFilter("PaymentProvider"), ref: "PaymentProvider.payments", access: { create: () => false, update: () => false } }),
    amountMinor: (0, import_fields13.integer)({ validation: { min: 0 } }),
    currencyCode: (0, import_fields13.text)(),
    status: (0, import_fields13.select)({ options: ["pending", "authorized", "captured", "failed", "partially_refunded", "refunded", "cancelled"].map((value) => ({ label: value, value })), defaultValue: "pending" }),
    providerReference: (0, import_fields13.text)(),
    idempotencyKey: (0, import_fields13.text)({ isIndexed: "unique", isFilterable: false, isOrderable: false, access: { read: import_access17.denyAll } }),
    providerEvidence: (0, import_fields13.json)({ defaultValue: {}, isFilterable: permissions.canManageFinance, isOrderable: permissions.canManageFinance, access: { read: permissions.canManageFinance } }),
    capturedAt: (0, import_fields13.timestamp)(),
    // What the charge is for, and for saved-card charges how many tries it took and why the last one failed.
    purpose: (0, import_fields13.select)({ options: [{ label: "Fare", value: "fare" }, { label: "Cancellation fee", value: "cancellation_fee" }, { label: "No-show fee", value: "no_show_fee" }], defaultValue: "fare", access: { create: () => false, update: () => false } }),
    attempts: (0, import_fields13.integer)({ defaultValue: 0, access: { create: () => false, update: () => false } }),
    lastAttemptAt: (0, import_fields13.timestamp)({ access: { create: () => false, update: () => false } }),
    failureCode: (0, import_fields13.text)({ access: { create: () => false, update: () => false } }),
    failureMessage: (0, import_fields13.text)({ access: { create: () => false, update: () => false } }),
    refunds: (0, import_fields13.relationship)({ ...relationFilter("Refund"), ref: "Refund.payment", many: true, access: { create: () => false, update: () => false } }),
    ledgerEntries: (0, import_fields13.relationship)({ ...relationFilter("LedgerEntry"), ref: "LedgerEntry.payment", many: true, access: { create: () => false, update: () => false } }),
    ...trackingFields
  }
});
var Refund = (0, import_core12.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["reason"] },
  access: financeAccess,
  fields: {
    label: labels.refund,
    payment: (0, import_fields13.relationship)({ ...relationFilter("Payment"), ref: "Payment.refunds", access: { create: () => false, update: () => false } }),
    provider: (0, import_fields13.relationship)({ ...relationFilter("PaymentProvider"), ref: "PaymentProvider.refunds", access: { create: () => false, update: () => false } }),
    amountMinor: (0, import_fields13.integer)({ validation: { min: 0 } }),
    currencyCode: (0, import_fields13.text)(),
    reason: (0, import_fields13.text)(),
    status: (0, import_fields13.select)({ options: ["requested", "processing", "succeeded", "failed", "cancelled"].map((value) => ({ label: value, value })), defaultValue: "requested" }),
    providerReference: (0, import_fields13.text)(),
    idempotencyKey: (0, import_fields13.text)({ isIndexed: "unique", isFilterable: false, isOrderable: false, access: { read: import_access17.denyAll } }),
    processedAt: (0, import_fields13.timestamp)(),
    ...trackingFields
  }
});
var LedgerEntry = (0, import_core12.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: financeAccess,
  fields: {
    label: labels.ledgerEntry,
    trip: (0, import_fields13.relationship)({ ...relationFilter("Trip"), ref: "Trip.ledgerEntries", access: { create: () => false, update: () => false } }),
    payment: (0, import_fields13.relationship)({ ...relationFilter("Payment"), ref: "Payment.ledgerEntries", access: { create: () => false, update: () => false } }),
    payout: (0, import_fields13.relationship)({ ...relationFilter("Payout"), ref: "Payout.ledgerEntries", access: { create: () => false, update: () => false } }),
    entryKey: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    kind: (0, import_fields13.select)({ options: ["rider_charge", "tax", "platform_fee", "driver_earning", "fleet_share", "tip", "refund", "adjustment", "payout_transfer"].map((value) => ({ label: value, value })) }),
    account: (0, import_fields13.text)({ validation: { isRequired: true } }),
    direction: (0, import_fields13.select)({ options: ["debit", "credit"].map((value) => ({ label: value, value })) }),
    amountMinor: (0, import_fields13.integer)({ validation: { min: 0 } }),
    currencyCode: (0, import_fields13.text)(),
    effectiveAt: (0, import_fields13.timestamp)({ defaultValue: { kind: "now" } }),
    memo: (0, import_fields13.text)(),
    metadata: (0, import_fields13.json)({ defaultValue: {} }),
    ...trackingFields
  }
});
var Payout = (0, import_core12.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: financeAccess,
  fields: {
    label: labels.payout,
    driver: (0, import_fields13.relationship)({ ...relationFilter("DriverProfile"), ref: "DriverProfile", access: { create: () => false, update: () => false } }),
    provider: (0, import_fields13.relationship)({ ...relationFilter("PaymentProvider"), ref: "PaymentProvider.payouts", access: { create: () => false, update: () => false } }),
    amountMinor: (0, import_fields13.integer)({ validation: { min: 0 } }),
    currencyCode: (0, import_fields13.text)(),
    status: (0, import_fields13.select)({ options: ["pending", "approved", "submitted", "paid", "failed", "cancelled"].map((value) => ({ label: value, value })), defaultValue: "pending" }),
    periodStart: (0, import_fields13.timestamp)(),
    periodEnd: (0, import_fields13.timestamp)(),
    providerReference: (0, import_fields13.text)(),
    evidence: (0, import_fields13.json)({ defaultValue: {} }),
    ledgerEntries: (0, import_fields13.relationship)({ ...relationFilter("LedgerEntry"), ref: "LedgerEntry.payout", many: true, access: { create: () => false, update: () => false } }),
    paidAt: (0, import_fields13.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/Integration.ts
var import_core13 = require("@keystone-6/core");
var import_access19 = require("@keystone-6/core/access");
var import_fields14 = require("@keystone-6/core/fields");
init_access();
var Notification = (0, import_core13.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: [] },
  access: lockedFleetAccess("fleetAdmin"),
  fields: {
    label: labels.notification,
    trip: (0, import_fields14.relationship)({ ...relationFilter("Trip"), ref: "Trip", access: { create: () => false, update: () => false } }),
    recipient: (0, import_fields14.relationship)({ ...relationFilter("User"), ref: "User", access: { create: () => false, update: () => false } }),
    channel: (0, import_fields14.select)({ options: ["email", "sms", "push", "webhook"].map((value) => ({ label: value, value })) }),
    templateKey: (0, import_fields14.text)(),
    status: (0, import_fields14.select)({ options: ["queued", "sending", "sent", "delivered", "failed", "dead_letter"].map((value) => ({ label: value, value })), defaultValue: "queued" }),
    payload: (0, import_fields14.json)({ defaultValue: {} }),
    providerReference: (0, import_fields14.text)({ isFilterable: false, isOrderable: false, access: { read: import_access19.denyAll } }),
    idempotencyKey: (0, import_fields14.text)({ isIndexed: "unique" }),
    sentAt: (0, import_fields14.timestamp)(),
    lastError: (0, import_fields14.text)(),
    ...trackingFields
  }
});
var MarketplaceRegistration = (0, import_core13.list)({
  ui: { hideCreate: true, hideDelete: true, labelField: "label", searchFields: ["sourceId", "platform"] },
  access: lockedFleetAccess("fleetAdmin"),
  fields: {
    label: labels.marketplaceRegistration,
    fleet: (0, import_fields14.relationship)({ ...relationFilter("Fleet"), ref: "Fleet.marketplaceRegistration", access: { create: () => false, update: () => false } }),
    sourceId: (0, import_fields14.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    platform: (0, import_fields14.text)({ defaultValue: "openfront-rideshare" }),
    status: (0, import_fields14.select)({ options: ["draft", "active", "paused", "revoked"].map((value) => ({ label: value, value })), defaultValue: "draft" }),
    manifestVersion: (0, import_fields14.text)({ defaultValue: "1" }),
    publicBaseUrl: (0, import_fields14.text)(),
    capabilities: (0, import_fields14.json)({ defaultValue: ["marketplace.discovery", "rideshare.quote", "rideshare.request", "rideshare.trip.view"] }),
    lastVerifiedAt: (0, import_fields14.timestamp)(),
    verificationEvidence: (0, import_fields14.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var rawModels = {
  User,
  Role,
  FleetBrandingChange,
  Fleet,
  FleetMembership,
  DriverProfile,
  RiderProfile,
  Vehicle,
  ComplianceDocument,
  Policy,
  PolicyEvaluation,
  ProviderConnection,
  ServiceArea,
  RideService,
  AvailabilityRule,
  AvailabilityException,
  FareRule,
  RideQuote,
  RideRequest,
  RequestCancellationCommand,
  MatchOffer,
  Trip,
  TripEvent,
  LocationEvent,
  Cancellation,
  SafetyIncident,
  SupportCase,
  Conversation,
  Message,
  Review,
  PaymentProvider,
  Payment,
  Refund,
  PaymentObservation,
  LedgerEntry,
  Payout,
  Notification,
  MarketplaceRegistration
};
var models = Object.fromEntries(Object.entries(rawModels).map(([key, config2]) => {
  const query = config2?.access?.operation?.query;
  if (typeof query !== "function") return [key, config2];
  const existing = config2?.ui?.isHidden;
  const isHidden = async (args) => {
    if (existing === true) return true;
    if (typeof existing === "function" && await existing(args)) return true;
    return !await query(args);
  };
  return [key, { ...config2, ui: { ...config2.ui ?? {}, isHidden } }];
}));

// features/keystone/ui-create-access.ts
function createRule(access) {
  if (typeof access === "function") return access;
  const operation = access?.operation;
  if (typeof operation === "function") return operation;
  if (typeof operation?.create === "function") return operation.create;
  return void 0;
}
async function createAllowed(listKey, list13, args) {
  const rule = createRule(list13.access);
  if (!rule) return true;
  try {
    return Boolean(await rule({ session: args.session, context: args.context, listKey, operation: "create" }));
  } catch {
    return false;
  }
}
function withCreateAwareUi(lists) {
  const out = {};
  for (const [listKey, list13] of Object.entries(lists)) {
    if (list13.ui?.hideCreate !== void 0 || !createRule(list13.access)) {
      out[listKey] = list13;
      continue;
    }
    out[listKey] = {
      ...list13,
      ui: {
        ...list13.ui,
        hideCreate: async (args) => !await createAllowed(listKey, list13, args)
      }
    };
  }
  return out;
}
function updateOperationRule(access) {
  if (typeof access === "function") return access;
  const rules = access?.operation;
  if (typeof rules === "function") return rules;
  if (typeof rules?.update === "function") return rules.update;
  return void 0;
}
function updateFilterRule(access) {
  const filter = access?.filter;
  return typeof filter?.update === "function" ? filter.update : void 0;
}
var itemModeCache = /* @__PURE__ */ new WeakMap();
async function itemUpdateAllowed(listKey, list13, args) {
  const operation = updateOperationRule(list13.access);
  if (operation) {
    try {
      if (!await operation({ session: args.session, context: args.context, listKey, operation: "update" })) return false;
    } catch {
      return false;
    }
  }
  const filterRule = updateFilterRule(list13.access);
  if (!filterRule || args.item?.id == null) return true;
  try {
    const filter = await filterRule({ session: args.session, context: args.context, listKey, operation: "update" });
    if (filter === true) return true;
    if (filter === false) return false;
    if (!filter || typeof filter !== "object") return true;
    const count = await args.context.sudo().db[listKey].count({ where: { AND: [{ id: { equals: String(args.item.id) } }, filter] } });
    return count > 0;
  } catch {
    return true;
  }
}
function withItemViewAwareUi(lists) {
  const out = {};
  for (const [listKey, list13] of Object.entries(lists)) {
    const itemView = list13.ui?.itemView ?? {};
    if (itemView.defaultFieldMode !== void 0 || !updateOperationRule(list13.access) && !updateFilterRule(list13.access)) {
      out[listKey] = list13;
      continue;
    }
    out[listKey] = {
      ...list13,
      ui: {
        ...list13.ui,
        itemView: {
          ...itemView,
          // Called once per field; one decision per request and item.
          defaultFieldMode: (args) => {
            const decide = () => itemUpdateAllowed(listKey, list13, args).then((ok) => ok ? "edit" : "read");
            if (!args.context || typeof args.context !== "object") return decide();
            const key = JSON.stringify([listKey, String(args.item?.id), String(args.session?.itemId ?? ""), String(args.session?.listKey ?? "")]);
            const scope = args.context;
            let cache2 = itemModeCache.get(scope);
            if (!cache2) itemModeCache.set(scope, cache2 = /* @__PURE__ */ new Map());
            let decision = cache2.get(key);
            if (!decision) cache2.set(key, decision = decide());
            return decision;
          }
        }
      }
    };
  }
  return out;
}
function deleteRule(access) {
  if (typeof access === "function") return access;
  const operation = access?.operation;
  if (typeof operation === "function") return operation;
  if (typeof operation?.delete === "function") return operation.delete;
  return void 0;
}
async function deleteAllowed(listKey, list13, args) {
  const rule = deleteRule(list13.access);
  if (!rule) return true;
  try {
    return Boolean(await rule({ session: args.session, context: args.context, listKey, operation: "delete" }));
  } catch {
    return false;
  }
}
function withDeleteAwareUi(lists) {
  const out = {};
  for (const [listKey, list13] of Object.entries(lists)) {
    if (list13.ui?.hideDelete !== void 0 || !deleteRule(list13.access)) {
      out[listKey] = list13;
      continue;
    }
    out[listKey] = {
      ...list13,
      ui: {
        ...list13.ui,
        hideDelete: async (args) => !await deleteAllowed(listKey, list13, args)
      }
    };
  }
  return out;
}

// features/keystone/mutations/fleetBranding.ts
init_access();

// features/keystone/domain/authorityFence.ts
init_access();
async function fenceHumanAuthority(tx, session2, fleetId) {
  const actorId = humanSessionId(session2);
  if (!actorId) throw new Error("A current human session is required.");
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actorId} FOR SHARE`;
  await tx.$queryRaw`SELECT r.id FROM "Role" r JOIN "User" u ON u.role = r.id WHERE u.id = ${actorId} FOR SHARE OF r`;
  if (fleetId) {
    await tx.$queryRaw`SELECT id FROM "Fleet" WHERE id = ${fleetId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "FleetMembership" WHERE "user" = ${actorId} AND fleet = ${fleetId} ORDER BY id FOR SHARE`;
  }
}

// features/keystone/mutations/fleetBranding.ts
var import_node_util = require("node:util");

// features/keystone/domain/commandBinding.ts
var import_node_crypto = require("node:crypto");
function canonical(value, depth = 0) {
  if (depth > 10) throw new Error("Command body is too deep.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => canonical(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== void 0).map((key) => [key, canonical(value[key], depth + 1)]));
  throw new Error("Command body is invalid.");
}
function commandBodyHash(body) {
  const serialized = JSON.stringify(canonical(body));
  if (Buffer.byteLength(serialized) > 32768) throw new Error("Command body is too large.");
  return (0, import_node_crypto.createHash)("sha256").update(serialized).digest("hex");
}
function requireCommandKey(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 200 || value !== value.trim()) throw new Error("A stable command key of 12\u2013200 characters is required.");
  return value;
}

// features/keystone/domain/fleetBrandingInput.ts
function buildFleetBrandingInput(args) {
  const logoIcon = sanitizeStoreLogoSvg(args.logoIcon);
  if (!logoIcon) throw new Error("Branding input is invalid.");
  const logoColor = normalizeStoreLogoColor(args.logoColor);
  if (args.name === void 0 || args.name === null) return { logoIcon, logoColor };
  const name = args.name.trim();
  if (!name || name.length > 120) throw new Error("Branding input is invalid.");
  return { logoIcon, logoColor, name };
}

// features/keystone/domain/reviewedVersion.ts
function reviewedIso(value) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function sameReviewedVersion(current, reviewed) {
  const iso = reviewedIso(reviewed);
  return iso !== null && current.toISOString() === iso;
}

// features/keystone/mutations/fleetBranding.ts
async function fleetBranding(_root, args, context) {
  return context.prisma.$transaction(async (tx) => {
    await fenceHumanAuthority(tx, context.session, args.fleetId);
    if (!await canAccessFleet({ prisma: tx }, context.session, args.fleetId, "fleetAdmin")) return null;
    const row = await tx.fleet.findUnique({ where: { id: args.fleetId }, select: { id: true, name: true, logoIcon: true, logoColor: true, updatedAt: true } });
    return row ? { actorId: context.session.itemId, fleetId: row.id, name: row.name, logoIcon: sanitizeStoreLogoSvg(row.logoIcon || "") || DEFAULT_STORE_LOGO_ICON, logoColor: normalizeStoreLogoColor(row.logoColor), updatedAt: row.updatedAt?.toISOString() } : null;
  }, { isolationLevel: "RepeatableRead" });
}
async function saveFleetBranding(_root, args, context) {
  const idempotencyKey = requireCommandKey(args.idempotencyKey);
  const reviewedAt = reviewedIso(args.expectedUpdatedAt);
  if (!reviewedAt) throw new Error("Branding input is invalid.");
  const input = buildFleetBrandingInput(args);
  const { logoIcon, logoColor } = input;
  return context.prisma.$transaction(async (tx) => {
    const actor = await currentHumanActor(tx, context.session);
    if (!actor || actor.id !== args.expectedActorId) throw new Error("Fleet branding is unavailable.");
    for (const key of [`command:${idempotencyKey}`, `fleet-branding:${args.fleetId}`].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text IS NOT NULL`;
    await fenceHumanAuthority(tx, context.session, args.fleetId);
    if (!await canAccessFleet({ prisma: tx }, context.session, args.fleetId, "fleetAdmin")) throw new Error("Fleet branding is unavailable.");
    const command = { version: 1, purpose: "fleet_branding", actorId: actor.id, fleetId: args.fleetId, expectedUpdatedAt: reviewedAt, logoIcon, logoColor, ...input.name !== void 0 ? { name: input.name } : {} };
    const prior = await tx.fleetBrandingChange.findUnique({ where: { idempotencyKey } });
    if (prior) {
      if (!(0, import_node_util.isDeepStrictEqual)(prior.command, command)) throw new Error("Branding key belongs to another command.");
      return prior.result;
    }
    const update = await tx.fleet.updateMany({ where: { id: args.fleetId, updatedAt: new Date(reviewedAt) }, data: { logoIcon, logoColor, ...input.name !== void 0 ? { name: input.name } : {} } });
    if (update.count !== 1) throw new Error("Branding changed. Read the current settings before saving again.");
    const row = await tx.fleet.findUnique({ where: { id: args.fleetId }, select: { id: true, name: true, logoIcon: true, logoColor: true, updatedAt: true } });
    const result = { actorId: actor.id, fleetId: row.id, name: row.name, logoIcon: row.logoIcon, logoColor: row.logoColor, updatedAt: row.updatedAt.toISOString() };
    await tx.fleetBrandingChange.create({ data: { fleetId: row.id, actorId: actor.id, idempotencyKey, command, result } });
    return result;
  }, { isolationLevel: "Serializable" });
}

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");
init_access();

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/domain/dateTimeFields.ts
function toDateTime(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}
function dateTimeFieldResolvers(typeDefs2) {
  const resolvers = {};
  for (const match of typeDefs2.matchAll(/\btype\s+(\w+)\s*\{([^}]*)\}/g)) {
    const [, typeName, body] = match;
    if (typeName === "Query" || typeName === "Mutation") continue;
    for (const field of body.matchAll(/(\w+)\s*:\s*DateTime!?/g)) {
      const name = field[1];
      (resolvers[typeName] ??= {})[name] = (parent) => toDateTime(parent?.[name]);
    }
  }
  return resolvers;
}

// features/keystone/domain/constraintErrors.ts
var import_graphql = require("graphql");
var RideshareRefusal = class extends import_graphql.GraphQLError {
  constructor(message) {
    super(message, { extensions: { code: "RIDESHARE_REFUSED" } });
  }
};

// features/keystone/mutations/marketplaceRideshare.ts
var import_node_crypto4 = require("node:crypto");

// features/keystone/domain/ownershipProof.ts
var import_node_crypto2 = require("node:crypto");
function secret() {
  const value = process.env.SESSION_SECRET || "";
  if (Buffer.byteLength(value) < 32) throw new Error("Ride receipt proof requires SESSION_SECRET of at least 32 characters.");
  return value;
}
function createOwnershipProof(purpose, resourceId, expiresAt) {
  return signProof({ v: 1, purpose, resourceId, expiresAt: expiresAt.getTime(), nonce: (0, import_node_crypto2.randomBytes)(18).toString("base64url") });
}
function createRecoverableRequestProof(requestId, requestNumber, expiresAt, quoteProof) {
  const nonce = (0, import_node_crypto2.createHmac)("sha256", secret()).update(JSON.stringify(["request-receipt/v2", requestId, requestNumber, expiresAt.getTime(), hashOwnershipProof(quoteProof)])).digest("base64url");
  return signProof({ v: 1, purpose: "request", resourceId: requestNumber, expiresAt: expiresAt.getTime(), nonce });
}
function signProof(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = (0, import_node_crypto2.createHmac)("sha256", secret()).update(body).digest("base64url");
  const token = `${body}.${signature}`;
  return { token, hash: hashOwnershipProof(token), payload };
}
function hashOwnershipProof(token) {
  return (0, import_node_crypto2.createHash)("sha256").update(token).digest("hex");
}
function verifyOwnershipProof(token, purpose, resourceId, expectedHash, now = Date.now()) {
  if (!token || token.length > 4096) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return false;
  const expectedSignature = (0, import_node_crypto2.createHmac)("sha256", secret()).update(body).digest();
  const actualSignature = Buffer.from(signature, "base64url");
  if (expectedSignature.length !== actualSignature.length || !(0, import_node_crypto2.timingSafeEqual)(expectedSignature, actualSignature)) return false;
  if (expectedHash) {
    const actualHash = Buffer.from(hashOwnershipProof(token), "hex");
    const storedHash = Buffer.from(expectedHash, "hex");
    if (actualHash.length !== storedHash.length || !(0, import_node_crypto2.timingSafeEqual)(actualHash, storedHash)) return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.v === 1 && payload.purpose === purpose && payload.resourceId === resourceId && payload.expiresAt > now;
  } catch {
    return false;
  }
}

// features/keystone/mutations/marketplaceRideshare.ts
init_request_confirmation();

// features/keystone/domain/requestReceipt.ts
var import_node_crypto3 = require("node:crypto");
init_access();
function requestIntent(args, riderId) {
  const passengerCount = args.passengerCount ?? 1;
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 50) throw new Error("Passenger count must be an integer from 1 to 50.");
  const needs = args.accessibilityNeeds ?? {};
  if (!needs || typeof needs !== "object" || Array.isArray(needs) || Object.keys(needs).some((key) => key !== "wheelchairAccessible") || "wheelchairAccessible" in needs && typeof needs.wheelchairAccessible !== "boolean") throw new Error("Accessibility needs must contain only a wheelchairAccessible boolean.");
  const riderNotes = args.riderNotes ?? "";
  const preciseRouteEncryptedRef = args.preciseRouteEncryptedRef ?? "";
  if (typeof riderNotes !== "string" || riderNotes.length > 1e3 || typeof preciseRouteEncryptedRef !== "string" || preciseRouteEncryptedRef.length > 1e3) throw new Error("Request notes or route reference is invalid.");
  return { quoteId: args.quoteId, passengerCount, accessibilityNeeds: { wheelchairAccessible: needs.wheelchairAccessible === true }, riderNotes, preciseRouteEncryptedRef, riderId };
}
function requestIntentHash(intent) {
  return (0, import_node_crypto3.createHash)("sha256").update(JSON.stringify(intent)).digest("hex");
}
function receiptBinding(quote, fleetId, intent) {
  return { version: 2, quoteId: quote.id, quotePublicId: quote.publicId, fleetId, riderId: intent.riderId, intentHash: requestIntentHash(intent) };
}
function recoverRequestReceipt(request, quote, intent, quoteProof) {
  const binding = request.quoteSnapshot?._requestReceipt;
  if (!binding || binding.version !== 2 || binding.quoteId !== quote.id || binding.quotePublicId !== quote.publicId || binding.fleetId !== request.fleetId || binding.riderId !== request.riderId || binding.intentHash !== requestIntentHash(intent) || !request.guestProofHash || !request.guestProofExpiresAt || request.guestProofExpiresAt.getTime() <= Date.now()) throw new Error("Original request receipt cannot be recovered with this intent; use the saved receipt or the owning account.");
  const proof = createRecoverableRequestProof(request.id, request.requestNumber, request.guestProofExpiresAt, quoteProof);
  if (!verifyOwnershipProof(proof.token, "request", request.requestNumber, request.guestProofHash)) throw new Error("Original request receipt is revoked or unavailable; use the owning account.");
  return { requestId: request.id, requestNumber: request.requestNumber, status: request.status, requestProof: proof.token, replayed: true };
}
function riderSessionId(session2) {
  return humanSessionId(session2);
}
function ownsRequest(request, session2, proof) {
  if (session2 && !riderSessionId(session2)) return false;
  const actorId = riderSessionId(session2);
  if (request.riderId) return Boolean(actorId && request.riderId === actorId);
  return Boolean(proof && request.guestProofHash && request.guestProofExpiresAt && new Date(request.guestProofExpiresAt).getTime() > Date.now() && verifyOwnershipProof(proof, "request", request.requestNumber, request.guestProofHash));
}

// features/keystone/domain/requestAuthority.ts
init_access();
var import_client = require("@prisma/client");
var requestAuthoritySelect = {
  id: true,
  requestNumber: true,
  riderId: true,
  fleetId: true,
  guestProofHash: true,
  guestProofExpiresAt: true
};
async function currentRiderId(db, session2) {
  if (!session2) return null;
  if (!humanSessionId(session2)) throw new Error("A current rider account session is required.");
  await fenceHumanAuthority(db, session2);
  const actor = await currentHumanActor(db, session2);
  if (!actor) throw new Error("A current rider account session is required.");
  return actor.id;
}
async function authorizedRequestHeader(db, session2, requestId, proof) {
  const riderId = await currentRiderId(db, session2);
  if (typeof requestId !== "string" || !requestId || requestId.length > 200) return null;
  if (!riderId && (typeof proof !== "string" || proof.length < 40 || proof.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(proof))) return null;
  const header = await db.rideRequest.findUnique({ where: { id: requestId }, select: requestAuthoritySelect });
  if (!header || !ownsRequest(header, session2, proof)) return null;
  return header;
}
function requestOwnerWhere(header) {
  return {
    id: header.id,
    fleetId: header.fleetId,
    riderId: header.riderId,
    AND: [
      { quoteSnapshot: { path: ["_requestReceipt", "version"], equals: 2 } },
      header.riderId ? { quoteSnapshot: { path: ["_requestReceipt", "riderId"], equals: header.riderId } } : { quoteSnapshot: { path: ["_requestReceipt", "riderId"], equals: import_client.Prisma.JsonNull } }
    ]
  };
}

// features/keystone/domain/requestTripBinding.ts
var import_node_util2 = require("node:util");
function hasRequestQuoteBinding(request) {
  if (!request.fleetId || request.quote?.requestId !== request.id || request.quote.service?.fleetId !== request.fleetId) return false;
  const snapshot = request.quoteSnapshot;
  const present = Boolean(snapshot && Object.prototype.hasOwnProperty.call(snapshot, "_requestReceipt"));
  const binding = snapshot?._requestReceipt;
  return !present || Boolean(binding && binding.version === 2 && binding.quoteId === request.quote.id && binding.quotePublicId === request.quote.publicId && binding.fleetId === request.fleetId && binding.riderId === request.riderId);
}
function hasRequestTripBinding(request, trip) {
  const offer = trip.acceptedOffer;
  const quote = trip.bookingSnapshot?.quote;
  return Boolean(hasRequestQuoteBinding(request) && trip.requestId === request.id && trip.fleetId === request.fleetId && trip.riderId === request.riderId && trip.driverId && trip.vehicleId && offer && trip.acceptedOfferId === offer.id && offer.requestId === request.id && offer.driverId === trip.driverId && offer.vehicleId === trip.vehicleId && (trip.status === "cancelled" ? offer.status === "withdrawn" : offer.status === "accepted") && quote && (0, import_node_util2.isDeepStrictEqual)(quote, request.quoteSnapshot));
}

// features/keystone/domain/publicTripProjection.ts
function projectPublishedReviews(reviews) {
  return (reviews || []).filter((review) => review?.status === "published").map((review) => ({
    direction: review.direction ?? null,
    rating: review.rating ?? null,
    body: review.body ?? null,
    status: "published",
    submittedAt: review.submittedAt ?? null
  }));
}

// features/keystone/domain/fleetBrand.ts
var fleetBrandSelect = { id: true, name: true, logoIcon: true, logoColor: true };
function projectFleetBrand(fleet) {
  if (!fleet?.id || typeof fleet.name !== "string") return null;
  return { fleetId: fleet.id, name: fleet.name, logoIcon: sanitizeStoreLogoSvg(fleet.logoIcon || "") || DEFAULT_STORE_LOGO_ICON, logoColor: normalizeStoreLogoColor(fleet.logoColor) };
}

// features/keystone/domain/riderTripProjection.ts
function mapPoint(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lon, lat] = value.map(Number);
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null;
}
function projectRiderTrip(trip) {
  const snapshot = trip.bookingSnapshot && typeof trip.bookingSnapshot === "object" ? trip.bookingSnapshot : {};
  const quote = snapshot.quote && typeof snapshot.quote === "object" ? snapshot.quote : {};
  const route = quote.routeEvidence && typeof quote.routeEvidence === "object" ? quote.routeEvidence : {};
  const service = snapshot.service && typeof snapshot.service === "object" ? snapshot.service : {};
  const vehicle = snapshot.vehicle && typeof snapshot.vehicle === "object" ? snapshot.vehicle : {};
  const fare = (value) => ({
    currencyCode: value.currencyCode || null,
    totalMinor: value.totalMinor ?? null,
    baseFareMinor: value.baseFareMinor ?? null,
    distanceMinor: value.distanceMinor ?? null,
    durationMinor: value.durationMinor ?? null,
    bookingFeeMinor: value.bookingFeeMinor ?? null,
    cancellationFeeMinor: value.cancellationFeeMinor ?? null,
    noShowFeeMinor: value.noShowFeeMinor ?? null,
    routeEvidence: { provider: route.provider || "unavailable", authoritative: route.authoritative === true, disclosure: route.disclosure || "Route evidence unavailable.", pickup: mapPoint(route.pickup), dropoff: mapPoint(route.dropoff) }
  });
  const events = Array.isArray(trip.events) ? trip.events : [];
  return {
    id: trip.id,
    requestId: trip.requestId,
    confirmationCode: trip.confirmationCode,
    status: trip.status,
    scheduledFor: trip.scheduledFor,
    fleetBrand: projectFleetBrand(trip.fleet),
    acceptedAt: trip.acceptedAt,
    enRouteAt: trip.enRouteAt,
    arrivedAt: trip.arrivedAt,
    startedAt: trip.startedAt,
    completedAt: trip.completedAt,
    cancelledAt: trip.cancelledAt,
    pickupLabel: trip.pickupLabel,
    dropoffLabel: trip.dropoffLabel,
    bookingSnapshot: { quote: fare(quote), service: { name: service.name, category: service.category }, vehicle: { label: vehicle.label, make: vehicle.make, model: vehicle.model, color: vehicle.color, plateMasked: vehicle.plateMasked } },
    finalFareSnapshot: trip.finalFareSnapshot && typeof trip.finalFareSnapshot === "object" ? fare(trip.finalFareSnapshot) : null,
    events: events.slice(0, 100).map((event) => ({ eventType: event.eventType, fromStatus: event.fromStatus, toStatus: event.toStatus, occurredAt: event.occurredAt })),
    historyTruncated: events.length > 100,
    payments: (trip.payments || []).map((payment) => ({ amountMinor: payment.amountMinor, currencyCode: payment.currencyCode, status: payment.status })),
    reviews: projectPublishedReviews(trip.reviews)
  };
}

// features/keystone/domain/keysetCursor.ts
function encodeKeyset(purpose, scope, boundary) {
  return Buffer.from(JSON.stringify({ v: 1, purpose, scope, ...boundary })).toString("base64url");
}
function decodeKeyset(value, purpose, scope) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1600 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid page cursor.");
  let data;
  try {
    data = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid page cursor.");
  }
  if (data?.v !== 1 || data.purpose !== purpose || data.scope !== scope || typeof data.id !== "string" || !data.id || data.id.length > 200 || data.time !== null && (typeof data.time !== "string" || !Number.isFinite(Date.parse(data.time)) || new Date(data.time).toISOString() !== data.time)) throw new Error("Invalid page cursor.");
  return { id: data.id, time: data.time };
}

// features/keystone/domain/publicMedia.ts
var DRIVER_RATING_MIN_REVIEWS = 5;
function driverRating(reviews, minimum = DRIVER_RATING_MIN_REVIEWS) {
  const ratings = (reviews || []).filter((review) => review?.status === "published" && review.direction === "rider_to_driver").map((review) => review.rating).filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);
  if (ratings.length < minimum) return null;
  const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  return { average: Math.round(average * 100) / 100, count: ratings.length };
}
function imageSelect(prefix) {
  return { [`${prefix}_id`]: true, [`${prefix}_extension`]: true };
}
var EXTENSIONS = /* @__PURE__ */ new Set(["jpg", "png", "webp", "gif"]);
async function imageUrl(context, row, prefix) {
  const id = row?.[`${prefix}_id`];
  const extension = row?.[`${prefix}_extension`];
  if (typeof id !== "string" || !id || !EXTENSIONS.has(extension)) return null;
  try {
    return await context.images("my_images").getUrl(id, extension);
  } catch {
    return null;
  }
}

// features/keystone/mutations/riderReceipts.ts
var requestInclude = {
  fleet: { select: fleetBrandSelect },
  quote: { include: { service: { select: { fleetId: true } } } },
  trip: { include: {
    fleet: { select: fleetBrandSelect },
    acceptedOffer: true,
    events: { orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 101 },
    payments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 },
    reviews: { where: { status: "published" }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 20 },
    driver: { select: { id: true, publicName: true, ...imageSelect("photo") } }
  } }
};
function projectRequest(request) {
  const bound = hasRequestQuoteBinding(request);
  const trip = bound && request.trip && hasRequestTripBinding(request, request.trip) ? projectRiderTrip(request.trip) : null;
  return {
    requestId: request.id,
    requestNumber: request.requestNumber,
    status: request.status,
    fleetBrand: projectFleetBrand(request.fleet),
    requestedFor: request.requestedFor,
    pickupLabel: request.pickupLabel,
    dropoffLabel: request.dropoffLabel,
    createdAt: request.createdAt,
    trip,
    handoffState: !bound || request.trip && !trip ? "unavailable" : request.status === "matching" && trip?.status === "cancelled" ? "reassignment_pending" : trip ? "assigned" : "awaiting_assignment"
  };
}
async function riderRequestStatus(_root, args, context) {
  return context.prisma.$transaction(async (tx) => {
    const header = await authorizedRequestHeader(tx, context.session, args.requestId, args.requestProof);
    if (!header) return null;
    const request = await tx.rideRequest.findFirst({ where: requestOwnerWhere(header), include: requestInclude });
    if (!request) return null;
    return projectRequest(request);
  }, { isolationLevel: "RepeatableRead" });
}
async function myRideshareRequests(_root, args, context) {
  return context.prisma.$transaction(async (tx) => {
    const riderId = await currentRiderId(tx, context.session);
    if (!riderId) throw new Error("A rider account session is required.");
    const scope = JSON.stringify([riderId]);
    const boundary = decodeKeyset(args.cursor, "rider_requests", scope);
    const rows = await tx.rideRequest.findMany({
      where: { riderId, ...boundary ? boundary.time === null ? { createdAt: null, id: { lt: boundary.id } } : { OR: [{ createdAt: { lt: new Date(boundary.time) } }, { createdAt: new Date(boundary.time), id: { lt: boundary.id } }, { createdAt: null }] } : {} },
      orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: 26,
      include: requestInclude
    });
    return { items: rows.slice(0, 25).map(projectRequest), nextCursor: rows.length > 25 ? encodeKeyset("rider_requests", scope, { id: rows[24].id, time: rows[24].createdAt?.toISOString() || null }) : null };
  }, { isolationLevel: "RepeatableRead" });
}
async function riderTripStatus(_root, args, context) {
  if (typeof args.confirmationCode !== "string" || !args.confirmationCode || args.confirmationCode.length > 200) return null;
  return context.prisma.$transaction(async (tx) => {
    const riderId = await currentRiderId(tx, context.session);
    const requestId = args.requestId || (riderId ? (await tx.rideRequest.findFirst({ where: { riderId, trip: { confirmationCode: args.confirmationCode } }, select: { id: true } }))?.id : null);
    if (!requestId) return null;
    const header = await authorizedRequestHeader(tx, context.session, requestId, args.requestProof);
    if (!header) return null;
    const request = await tx.rideRequest.findFirst({ where: { ...requestOwnerWhere(header), trip: { is: { confirmationCode: args.confirmationCode } } }, include: requestInclude });
    if (!request || request.trip?.confirmationCode !== args.confirmationCode || !hasRequestTripBinding(request, request.trip)) return null;
    const driverId = request.trip.driver?.id;
    const driverReviews = driverId ? await tx.review.findMany({ where: { status: "published", direction: "rider_to_driver", trip: { is: { driverId } } }, select: { rating: true, direction: true, status: true }, take: 5e3 }) : [];
    return { trip: projectRiderTrip(request.trip), driver: request.trip.driver, driverReviews };
  }, { isolationLevel: "RepeatableRead" }).then(async (found) => {
    if (!found) return null;
    const { trip, driver, driverReviews } = found;
    if (!driver?.publicName) return { ...trip, driver: null };
    const rating = driverRating(driverReviews);
    return { ...trip, driver: { publicName: driver.publicName, photoUrl: await imageUrl(context, driver, "photo"), rating: rating?.average ?? null, ratingCount: rating?.count ?? null } };
  });
}

// features/integrations/mapping/osm.ts
var USER_AGENT = "openfront-rideshare/1.0 (+https://github.com/openshiporg/openfront-rideshare)";
var osrmBase = () => (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
function cache(max, ttlMs) {
  const entries = /* @__PURE__ */ new Map();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) return void 0;
      if (Date.now() - hit.at > ttlMs) {
        entries.delete(key);
        return void 0;
      }
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    },
    set(key, value) {
      entries.set(key, { at: Date.now(), value });
      while (entries.size > max) entries.delete(entries.keys().next().value);
    }
  };
}
function gate(intervalMs, maxWaitMs) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const at = Math.max(now, next);
    if (at - now > maxWaitMs) return false;
    next = at + intervalMs;
    if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
    return true;
  };
}
var placeCache = cache(500, 10 * 6e4);
var routeCache = cache(500, 30 * 6e4);
var photonGate = gate(350, 2500);
var osrmGate = gate(1e3, 2500);
function validPoint(value) {
  const pair = Array.isArray(value) ? value : value && typeof value === "object" ? [value.lon ?? value.lng, value.lat] : null;
  if (!pair || pair.length !== 2) return null;
  const [lon, lat] = pair.map(Number);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return [round(lon), round(lat)];
}
var round = (value, digits = 5) => Math.round(value * 10 ** digits) / 10 ** digits;
var EARTH_RADIUS_METERS = 6371e3;
function straightLine(from, to) {
  const rad = (degrees) => degrees * Math.PI / 180;
  const dLat = rad(to[1] - from[1]);
  const dLon = rad(to[0] - from[0]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from[1])) * Math.cos(rad(to[1])) * Math.sin(dLon / 2) ** 2;
  const meters = 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
  const distanceMeters = Math.round(meters * 1.35);
  return { distanceMeters, durationSeconds: Math.round(distanceMeters / (28e3 / 3600)), coordinates: [from, to], provider: "straight-line" };
}
async function routeBetween(from, to) {
  const key = `${from.join(",")};${to.join(",")}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  if (from[0] === to[0] && from[1] === to[1]) return straightLine(from, to);
  if (await osrmGate()) {
    try {
      const response = await fetch(`${osrmBase()}/route/v1/driving/${key}?overview=full&geometries=geojson&alternatives=false&steps=false`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6e3) });
      const payload = response.ok ? await response.json() : null;
      const route = payload?.code === "Ok" ? payload.routes?.[0] : null;
      const coordinates = Array.isArray(route?.geometry?.coordinates) ? route.geometry.coordinates.map(validPoint).filter(Boolean) : [];
      if (route && route.distance > 0 && coordinates.length >= 2) {
        const step = Math.max(1, Math.ceil(coordinates.length / 1500));
        const thinned = coordinates.filter((_, index) => index % step === 0 || index === coordinates.length - 1);
        const routed = { distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration), coordinates: thinned, provider: "osrm" };
        routeCache.set(key, routed);
        return routed;
      }
    } catch {
    }
  }
  return straightLine(from, to);
}

// features/keystone/domain/operationalReadiness.ts
var import_graphql3 = require("graphql");
function operationsEnabled(mode) {
  return mode === "manual" || mode === "auto";
}
function rideReadiness(mode) {
  const enabled = operationsEnabled(mode);
  return {
    bookingEnabled: enabled,
    mode: mode === "manual" || mode === "auto" ? mode : "unavailable",
    reason: mode === "auto" ? "Your ride goes to the nearest available driver." : mode === "manual" ? "An operator assigns your driver." : "Online booking is not open yet."
  };
}
var OPERATIONS_OFF_MESSAGE = "Dispatch is off for this fleet. Turn it on in Platform \u2192 Settings \u2192 Operations.";
async function requireFleetOperations(db, fleetId) {
  const fleet = fleetId ? await db.fleet.findUnique({ where: { id: fleetId }, select: { operationsMode: true } }) : null;
  if (!fleet || !operationsEnabled(fleet.operationsMode)) throw new import_graphql3.GraphQLError(OPERATIONS_OFF_MESSAGE, { extensions: { code: "RIDESHARE_OPERATIONS_OFF" } });
}

// features/keystone/domain/serviceReadiness.ts
async function requireServiceReadiness(tx, serviceId, fleetId) {
  if (!serviceId) throw new Error("Service is unavailable.");
  await tx.$queryRaw`SELECT id FROM "RideService" WHERE id = ${serviceId} FOR SHARE`;
  const service = await tx.rideService.findUnique({ where: { id: serviceId }, select: { id: true, fleetId: true, status: true } });
  if (!service?.fleetId || fleetId && service.fleetId !== fleetId || service.status !== "active") throw new Error("Service is unavailable.");
  await tx.$queryRaw`SELECT id FROM "Fleet" WHERE id = ${service.fleetId} FOR SHARE`;
  const fleet = await tx.fleet.findUnique({ where: { id: service.fleetId }, select: { id: true, status: true } });
  const areas = await tx.serviceArea.findMany({ where: { fleetId: service.fleetId, status: "active", services: { some: { id: service.id } } }, orderBy: { id: "asc" }, take: 1, select: { id: true } });
  if (fleet?.status !== "active" || !areas.length) throw new Error("Service is unavailable.");
  await tx.$queryRaw`SELECT id FROM "ServiceArea" WHERE id = ${areas[0].id} FOR SHARE`;
  const area = await tx.serviceArea.findFirst({ where: { id: areas[0].id, fleetId: service.fleetId, status: "active", services: { some: { id: service.id } } }, select: { id: true } });
  if (!area) throw new Error("Service is unavailable.");
  return service;
}

// features/keystone/domain/requestNumber.ts
function fleetDateStamp(at, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (type) => parts.find((item) => item.type === type)?.value || "";
    return `${part("year")}${part("month")}${part("day")}`;
  } catch {
    return at.toISOString().slice(0, 10).replaceAll("-", "");
  }
}
function rideRequestNumber(at, timezone, suffix) {
  return `RIDE-${fleetDateStamp(at, timezone)}-${suffix}`;
}

// features/keystone/domain/popularPlaces.ts
var POPULAR_PLACE_MIN_RIDERS = 3;
var POPULAR_PLACE_WINDOW_DAYS = 90;
var tidy = (label) => label.trim().replace(/\s+/g, " ");
var looksLikeStreetAddress = (label) => /^\d+[a-z]?\b/i.test(label) || /\b(apt|apartment|unit|suite|ste|#)\s*\w+/i.test(label);
function popularPlaces(rows, options = {}) {
  const minRiders = options.minRiders ?? POPULAR_PLACE_MIN_RIDERS;
  const limit = options.limit ?? 3;
  const excluded = new Set((options.exclude || []).map((label) => tidy(label).toLowerCase()));
  const places = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row.riderId) continue;
    for (const raw of [row.dropoffLabel, row.pickupLabel]) {
      const label = tidy(raw || "");
      if (label.length < 2 || label.length > 120 || looksLikeStreetAddress(label)) continue;
      const key = label.toLowerCase();
      if (excluded.has(key)) continue;
      const place = places.get(key) || { label, riders: /* @__PURE__ */ new Set(), uses: 0 };
      place.riders.add(row.riderId);
      place.uses++;
      places.set(key, place);
    }
  }
  return [...places.values()].filter((place) => place.riders.size >= minRiders).sort((a, b) => b.riders.size - a.riders.size || b.uses - a.uses || a.label.localeCompare(b.label)).slice(0, limit).map((place) => place.label);
}

// features/keystone/mutations/marketplaceRideshare.ts
var cleanLabel = (value, name) => {
  const label = String(value || "").trim().replace(/\s+/g, " ");
  if (label.length < 2 || label.length > 120) throw new RideshareRefusal(`${name} must be between 2 and 120 characters.`);
  return label;
};
async function marketplaceRideshareService(_root, args, context) {
  if (typeof args.id !== "string" || !args.id || args.id.length > 200) return null;
  const rows = await marketplaceRideshareServices(null, { serviceId: args.id, limit: 1 }, context);
  return rows[0] || null;
}
async function marketplaceRideshareServiceAreas(_root, args, context) {
  if (typeof args.serviceId !== "string" || !args.serviceId || args.serviceId.length > 200 || args.after && (typeof args.after !== "string" || args.after.length > 200)) throw new RideshareRefusal("Invalid service area page.");
  const service = await context.prisma.rideService.findFirst({ where: { id: args.serviceId, status: "active", fleet: { is: { status: "active" } } }, select: { id: true, fleetId: true } });
  if (!service?.fleetId) return { items: [], nextCursor: null };
  const where = { fleetId: service.fleetId, status: "active", services: { some: { id: service.id } } };
  if (args.after && !await context.prisma.serviceArea.findFirst({ where: { ...where, id: args.after }, select: { id: true } })) throw new RideshareRefusal("Invalid service area page.");
  const rows = await context.prisma.serviceArea.findMany({ where: { ...where, ...args.after ? { id: { gt: args.after } } : {} }, orderBy: { id: "asc" }, take: 25, select: { id: true, name: true, publicRegionLabel: true, countryCode: true } });
  return { items: rows.slice(0, 24), nextCursor: rows.length > 24 ? rows[23].id : null };
}
async function marketplaceRidesharePopularPlaces(_root, args, context) {
  if (typeof args.serviceId !== "string" || !args.serviceId || args.serviceId.length > 200) return [];
  const service = await context.prisma.rideService.findFirst({ where: { id: args.serviceId, status: "active", fleet: { is: { status: "active" } } }, select: { fleetId: true, serviceAreas: { where: { status: "active" }, take: 24, select: { publicRegionLabel: true } } } });
  if (!service?.fleetId) return [];
  const rows = await context.prisma.rideRequest.findMany({
    where: { fleetId: service.fleetId, riderId: { not: null }, createdAt: { gte: new Date(Date.now() - POPULAR_PLACE_WINDOW_DAYS * 864e5) } },
    orderBy: { createdAt: "desc" },
    take: 2e3,
    select: { riderId: true, pickupLabel: true, dropoffLabel: true }
  });
  return popularPlaces(rows, { exclude: service.serviceAreas.map((area) => area.publicRegionLabel) });
}
async function marketplaceRideshareServices(_root, args, context) {
  const limit = Math.max(1, Math.min(Number(args.limit) || 10, 24));
  const query = String(args.query || "").trim().slice(0, 100);
  const location = String(args.location || "").trim().slice(0, 100);
  let boundary = null;
  if (args.after) {
    if (typeof args.after !== "string" || args.after.length > 1600) throw new RideshareRefusal("Invalid discovery cursor.");
    let value;
    try {
      value = JSON.parse(Buffer.from(args.after, "base64url").toString());
    } catch {
      throw new RideshareRefusal("Invalid discovery cursor.");
    }
    if (value?.v !== 1 || value.query !== query || value.location !== location || typeof value.name !== "string" || value.name.length > 300 || typeof value.id !== "string" || value.id.length > 200) throw new RideshareRefusal("Invalid discovery cursor.");
    boundary = value;
  }
  const services = await context.sudo().query.RideService.findMany({
    where: {
      ...args.serviceId ? { id: { equals: args.serviceId } } : {},
      ...boundary ? { AND: [{ OR: [{ name: { gt: boundary.name } }, { name: { equals: boundary.name }, id: { gt: boundary.id } }] }] } : {},
      status: { equals: "active" },
      fleet: { status: { equals: "active" } },
      ...location ? { serviceAreas: { some: { status: { equals: "active" }, publicRegionLabel: { contains: location, mode: "insensitive" } } } } : { serviceAreas: { some: { status: { equals: "active" } } } },
      ...query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}
    },
    take: limit + 1,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    // Stable bounded public projection.
    query: `id name slug description photo { url } category passengerCapacity wheelchairAccessible advanceBookingMinutes fleet { id operationsMode name slug publicDescription heroImage { url } publicCity countryCode currencyCode logoIcon logoColor } serviceAreas(where: { status: { equals: "active" } }, orderBy: [{ publicRegionLabel: asc }, { id: asc }], take: 25) { id name publicRegionLabel countryCode status fleet { id } } fareRules(where: { status: { equals: "active" } }, orderBy: { version: desc }, take: 1) { id currencyCode baseFareMinor minimumFareMinor }`
  });
  return services.slice(0, limit).filter((service) => service.fleet).map((service, index) => {
    const publicRegionLabels = service.serviceAreas.slice(0, 24).filter((area) => area.fleet?.id === service.fleet.id).map((area) => area.publicRegionLabel);
    return {
      id: service.id,
      title: service.name,
      description: service.description,
      photoUrl: service.photo?.url ?? null,
      category: service.category,
      passengerCapacity: service.passengerCapacity,
      wheelchairAccessible: service.wheelchairAccessible,
      advanceBookingMinutes: service.advanceBookingMinutes,
      publicRegionLabels,
      readiness: rideReadiness(service.fleet.operationsMode),
      areasTruncated: service.serviceAreas.length > 24,
      nextCursor: services.length > limit && index === limit - 1 ? Buffer.from(JSON.stringify({ v: 1, query, location, name: service.name, id: service.id })).toString("base64url") : null,
      fleet: { ...projectFleetBrand(service.fleet), id: service.fleet.id, name: service.fleet.name, publicDescription: service.fleet.publicDescription, heroImageUrl: service.fleet.heroImage?.url ?? null, publicCity: service.fleet.publicCity, countryCode: service.fleet.countryCode },
      startingFareMinor: service.fareRules?.[0]?.minimumFareMinor ?? null,
      currencyCode: service.fareRules?.[0]?.currencyCode || service.fleet.currencyCode,
      extension: { schema: "openfront.rideshare.service/v1", value: { category: service.category, passengerCapacity: service.passengerCapacity, wheelchairAccessible: service.wheelchairAccessible, serviceAreas: publicRegionLabels } }
    };
  });
}
async function marketplaceRideshareEstimates(_root, args, context) {
  const from = validPoint(args.pickupPoint);
  const to = validPoint(args.dropoffPoint);
  if (!from || !to) throw new RideshareRefusal("Pickup or destination location is invalid.");
  const route = await quoteRoute("Pickup", "Destination", from, to);
  const services = await context.sudo().query.RideService.findMany({
    where: { status: { equals: "active" }, fleet: { status: { equals: "active" } }, serviceAreas: { some: { status: { equals: "active" } } } },
    take: 24,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    query: 'id fareRules(where: { status: { equals: "active" } }, take: 1, orderBy: { version: desc }) { currencyCode baseFareMinor perDistanceUnitMinor distanceUnit perMinuteMinor bookingFeeMinor minimumFareMinor maximumMultiplierBasisPoints cancellationFeeMinor noShowFeeMinor }'
  });
  const options = services.flatMap((service) => {
    const rule = service.fareRules?.[0];
    if (!rule) return [];
    try {
      const fare = calculateFare(rule, route.distanceMeters, route.durationSeconds);
      return [{ serviceId: service.id, totalMinor: fare.totalMinor, currencyCode: fare.currencyCode, cancellationFeeMinor: rule.cancellationFeeMinor ?? 0, noShowFeeMinor: rule.noShowFeeMinor ?? 0 }];
    } catch {
      return [];
    }
  });
  return { distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, provider: route.evidence.provider, options };
}
async function quoteRoute(pickupLabel, dropoffLabel, pickupPoint, dropoffPoint) {
  const from = pickupPoint == null ? null : validPoint(pickupPoint);
  const to = dropoffPoint == null ? null : validPoint(dropoffPoint);
  if (pickupPoint != null && !from || dropoffPoint != null && !to) throw new RideshareRefusal("Pickup or destination location is invalid.");
  if (from && to) {
    const path = await routeBetween(from, to);
    if (path.distanceMeters > 3e5) throw new RideshareRefusal("Pickup and destination are too far apart.");
    const points = { pickup: from.map((value) => Math.round(value * 1e4) / 1e4), dropoff: to.map((value) => Math.round(value * 1e4) / 1e4) };
    return {
      distanceMeters: Math.max(path.distanceMeters, 200),
      durationSeconds: Math.max(path.durationSeconds, 120),
      evidence: { provider: path.provider === "osrm" ? "osrm" : "straight-line", observedAt: (/* @__PURE__ */ new Date()).toISOString(), authoritative: false, disclosure: "Estimated from the driving route between your pickup and destination.", ...points }
    };
  }
  throw new RideshareRefusal("Choose the pickup and destination on the map.");
}
async function marketplaceRideshareQuote(_root, args, context) {
  return context.transaction(async (context2) => {
    const riderId = await currentRiderId(context2.prisma, context2.session);
    const pickupLabel = cleanLabel(args.pickupLabel, "pickupLabel");
    const dropoffLabel = cleanLabel(args.dropoffLabel, "dropoffLabel");
    const scheduledFor = args.scheduledFor ? new Date(args.scheduledFor) : null;
    if (scheduledFor && (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() - 6e4)) throw new RideshareRefusal("scheduledFor must be a future date.");
    const service = await context2.sudo().query.RideService.findOne({ where: { id: args.serviceId }, query: `id name status category passengerCapacity wheelchairAccessible advanceBookingMinutes fleet { id status currencyCode } fareRules(where: { status: { equals: "active" } }, take: 1, orderBy: { version: desc }) { id version currencyCode baseFareMinor perDistanceUnitMinor distanceUnit perMinuteMinor bookingFeeMinor minimumFareMinor maximumMultiplierBasisPoints cancellationFeeMinor noShowFeeMinor }` });
    if (!service || service.status !== "active" || service.fleet?.status !== "active" || !service.fareRules?.[0]) throw new RideshareRefusal("Service is not available for quoting.");
    const passengerCount = args.passengerCount ?? 1;
    if (!Number.isSafeInteger(passengerCount) || passengerCount < 1 || passengerCount > 50) throw new RideshareRefusal("Passenger count must be a whole number from 1 to 50.");
    if (passengerCount > service.passengerCapacity) throw new RideshareRefusal("Passenger count exceeds this service capacity.");
    if (args.wheelchairAccessible && !service.wheelchairAccessible) throw new RideshareRefusal("This service does not advertise wheelchair-accessible vehicles.");
    if (scheduledFor && scheduledFor.getTime() < Date.now() + service.advanceBookingMinutes * 6e4) throw new RideshareRefusal("This service requires more advance notice for scheduled rides.");
    await requireFleetOperations(context2.prisma, service.fleet.id);
    await requireServiceReadiness(context2.prisma, service.id, service.fleet.id);
    const route = await quoteRoute(pickupLabel, dropoffLabel, args.pickupPoint, args.dropoffPoint);
    const rule = service.fareRules[0];
    const breakdown = calculateFare(rule, route.distanceMeters, route.durationSeconds);
    const publicId = `rq_${(0, import_node_crypto4.randomUUID)()}`;
    const expiresAt = new Date(Date.now() + 10 * 6e4);
    const proof = createOwnershipProof("quote", publicId, expiresAt);
    await context2.sudo().query.RideQuote.createOne({ data: {
      publicId,
      ...riderId ? { rider: { connect: { id: riderId } } } : {},
      handoffId: args.handoffId?.trim() || "",
      status: "active",
      service: { connect: { id: service.id } },
      fareRule: { connect: { id: rule.id } },
      pickupLabel,
      dropoffLabel,
      routeInputHash: proof.hash,
      routeEvidence: route.evidence,
      estimatedDistanceMeters: route.distanceMeters,
      estimatedDurationSeconds: route.durationSeconds,
      fareSnapshot: { ...breakdown, _quoteOwner: { kind: riderId ? "account" : "guest", userId: riderId }, cancellationFeeMinor: rule.cancellationFeeMinor, noShowFeeMinor: rule.noShowFeeMinor, fareRuleId: rule.id, fareRuleVersion: rule.version, service: { id: service.id, fleetId: service.fleet.id, name: service.name, category: service.category, passengerCapacity: service.passengerCapacity, wheelchairAccessible: service.wheelchairAccessible }, routeEvidence: route.evidence },
      totalMinor: breakdown.totalMinor,
      currencyCode: breakdown.currencyCode,
      scheduledFor,
      expiresAt,
      guestProofHash: proof.hash
    }, query: "id" });
    return { quoteId: publicId, quoteProof: proof.token, expiresAt: expiresAt.toISOString(), pickupLabel, dropoffLabel, scheduledFor: scheduledFor?.toISOString() || null, estimatedDistanceMeters: route.distanceMeters, estimatedDurationSeconds: route.durationSeconds, cancellationFeeMinor: rule.cancellationFeeMinor, noShowFeeMinor: rule.noShowFeeMinor, fare: breakdown, estimateDisclosure: route.evidence.provider === "manual-estimate" ? "Estimated from your pickup and destination areas. The fleet confirms the final fare." : "Estimated from the driving route. The fleet confirms the final fare.", sourceCheckoutPath: `/book?service=${encodeURIComponent(service.id)}` };
  });
}
async function requestRide(_root, args, context) {
  const prisma = context.prisma;
  const receiptEmail = normalizeReceiptEmail(args.receiptEmail);
  const placed = await prisma.$transaction(async (tx) => {
    const riderId = await currentRiderId(tx, context.session);
    const intent = requestIntent(args, riderId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${args.quoteId}, 0))::text IS NOT NULL`;
    const quoteHeader = await tx.rideQuote.findUnique({ where: { publicId: args.quoteId }, select: { id: true, publicId: true, guestProofHash: true, riderId: true, requestId: true } });
    if (!quoteHeader?.guestProofHash || typeof args.quoteProof !== "string" || args.quoteProof.length > 4096 || !verifyOwnershipProof(args.quoteProof, "quote", quoteHeader.publicId, quoteHeader.guestProofHash, quoteHeader.requestId ? 0 : Date.now()) || quoteHeader.riderId && quoteHeader.riderId !== riderId) throw new RideshareRefusal("Quote is invalid or not owned by this session.");
    if (quoteHeader.requestId) {
      const requestHeader = await tx.rideRequest.findUnique({ where: { id: quoteHeader.requestId }, select: { id: true, fleetId: true, riderId: true } });
      if (!requestHeader || requestHeader.riderId !== riderId) throw new RideshareRefusal("Original receipt ownership is unavailable.");
      const existing = await tx.rideRequest.findFirst({ where: requestOwnerWhere(requestHeader) });
      if (!existing) throw new RideshareRefusal("Original receipt ownership is unavailable.");
      return recoverRequestReceipt(existing, quoteHeader, intent, args.quoteProof);
    }
    const quote = await tx.rideQuote.findFirst({ where: { id: quoteHeader.id, riderId, fareSnapshot: { path: ["_quoteOwner", "kind"], equals: riderId ? "account" : "guest" } } });
    if (!quote || !quote.guestProofHash || !verifyOwnershipProof(args.quoteProof, "quote", quote.publicId, quote.guestProofHash, quote.requestId ? 0 : Date.now()) || quote.riderId && quote.riderId !== intent.riderId) throw new RideshareRefusal("Quote is invalid or not owned by this session.");
    if (quote.requestId) {
      const existing = await tx.rideRequest.findUnique({ where: { id: quote.requestId } });
      if (!existing || quote.requestId !== existing.id) throw new RideshareRefusal("Request receipt is temporarily unavailable; retry with the same quote proof.");
      const service2 = quote.serviceId ? await tx.rideService.findUnique({ where: { id: quote.serviceId }, select: { fleetId: true } }) : null;
      if (!service2?.fleetId || service2.fleetId !== existing.fleetId) throw new RideshareRefusal("Original request binding is unavailable.");
      return recoverRequestReceipt(existing, quote, intent, args.quoteProof);
    }
    if (quote.status !== "active" || quote.expiresAt <= /* @__PURE__ */ new Date()) throw new RideshareRefusal("Quote is invalid or expired.");
    const quoteSnapshot = quote.fareSnapshot && typeof quote.fareSnapshot === "object" && !Array.isArray(quote.fareSnapshot) ? quote.fareSnapshot : {};
    const serviceSnapshot = quoteSnapshot.service && typeof quoteSnapshot.service === "object" ? quoteSnapshot.service : {};
    const passengerCount = intent.passengerCount;
    if (passengerCount > Number(serviceSnapshot.passengerCapacity || 0)) throw new RideshareRefusal("Passenger count exceeds the quoted service capacity.");
    const accessibilityNeeds = intent.accessibilityNeeds;
    if (accessibilityNeeds.wheelchairAccessible === true && serviceSnapshot.wheelchairAccessible !== true) throw new RideshareRefusal("The quoted service does not meet the accessibility requirement.");
    const proofExpiry = new Date(Math.max(Date.now(), quote.scheduledFor ? new Date(quote.scheduledFor).getTime() : 0) + 24 * 60 * 6e4);
    const requestId = (0, import_node_crypto4.randomUUID)();
    if (!quote.serviceId) throw new RideshareRefusal("The quote no longer references a service.");
    const service = await requireServiceReadiness(tx, quote.serviceId);
    if (!service?.fleetId) throw new RideshareRefusal("The quoted service is no longer attached to an operating fleet.");
    await requireFleetOperations(tx, service.fleetId);
    const fleetZone = (await tx.fleet.findUnique({ where: { id: service.fleetId }, select: { timezone: true } }))?.timezone;
    const requestNumber = rideRequestNumber(/* @__PURE__ */ new Date(), fleetZone, (0, import_node_crypto4.randomUUID)().slice(0, 8).toUpperCase());
    const receiptProof = createRecoverableRequestProof(requestId, requestNumber, proofExpiry, args.quoteProof);
    const request = await tx.rideRequest.create({ data: {
      id: requestId,
      fleetId: service.fleetId,
      riderId: intent.riderId,
      requestNumber,
      status: "requested",
      requestedFor: quote.scheduledFor,
      passengerCount,
      accessibilityNeeds,
      riderNotes: intent.riderNotes,
      pickupLabel: quote.pickupLabel,
      dropoffLabel: quote.dropoffLabel,
      preciseRouteEncryptedRef: intent.preciseRouteEncryptedRef,
      quoteSnapshot: { ...quoteSnapshot, _requestReceipt: receiptBinding(quote, service.fleetId, intent) },
      guestProofHash: receiptProof.hash,
      guestProofExpiresAt: proofExpiry
    } });
    await tx.rideQuote.update({ where: { id: quote.id }, data: { status: "accepted", request: { connect: { id: request.id } } } });
    return { requestId: request.id, requestNumber, status: request.status, requestProof: receiptProof.token, replayed: false };
  }, { isolationLevel: "Serializable" });
  if (placed.replayed === false) {
    try {
      const { deliverRequestReceived: deliverRequestReceived2 } = await Promise.resolve().then(() => (init_request_confirmation(), request_confirmation_exports));
      await deliverRequestReceived2(prisma, placed.requestId, void 0, { receiptEmail, requestProof: placed.requestProof });
    } catch {
    }
  }
  return placed;
}
async function publicRideshareRequest(_root, args, context) {
  return riderRequestStatus(_root, args, context);
}
async function resolveRideRequestIntent(_root, args, context) {
  return context.prisma.$transaction(async (tx) => {
    const riderId = await currentRiderId(tx, context.session);
    const intent = requestIntent(args, riderId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${args.quoteId}, 0))::text IS NOT NULL`;
    const header = await tx.rideQuote.findUnique({ where: { publicId: args.quoteId }, select: { id: true, publicId: true, riderId: true, guestProofHash: true, requestId: true } });
    if (!header?.guestProofHash || typeof args.quoteProof !== "string" || args.quoteProof.length > 4096 || !verifyOwnershipProof(args.quoteProof, "quote", header.publicId, header.guestProofHash, 0) || header.riderId !== riderId) throw new RideshareRefusal("Original request intent is unavailable.");
    if (header.requestId) {
      const requestHeader = await tx.rideRequest.findUnique({ where: { id: header.requestId }, select: { id: true, riderId: true, fleetId: true } });
      if (!requestHeader || requestHeader.riderId !== riderId) throw new RideshareRefusal("Original request intent is unavailable.");
      const request = await tx.rideRequest.findFirst({ where: requestOwnerWhere(requestHeader) });
      if (!request) throw new RideshareRefusal("Original request intent is unavailable.");
      return { kind: "request", quoteId: args.quoteId, receipt: recoverRequestReceipt(request, header, intent, args.quoteProof) };
    }
    const quote = await tx.rideQuote.findFirst({ where: { id: header.id, riderId, fareSnapshot: { path: ["_quoteOwner", "kind"], equals: riderId ? "account" : "guest" } } });
    if (!quote) throw new RideshareRefusal("Original quote ownership provenance is unavailable.");
    const snapshot = quote.fareSnapshot || {};
    const binding = { version: 1, purpose: "unused_quote_resolution", riderId, quoteId: header.publicId, intentHash: requestIntentHash(intent) };
    if (snapshot._intentResolution) {
      if (JSON.stringify(snapshot._intentResolution.binding) !== JSON.stringify(binding)) throw new RideshareRefusal("Original resolution body is different.");
      if (quote.status !== "void") throw new RideshareRefusal("Resolution state is unavailable.");
    } else {
      if (!["active", "expired", "void"].includes(quote.status)) throw new RideshareRefusal("Original quote state is unavailable.");
      const closed = await tx.rideQuote.updateMany({ where: { id: quote.id, requestId: null, status: quote.status }, data: { status: "void", fareSnapshot: { ...snapshot, _intentResolution: { binding, result: "closed_unused", occurredAt: (/* @__PURE__ */ new Date()).toISOString() } } } });
      if (closed.count !== 1) throw new RideshareRefusal("Original quote changed; reconcile the same intent again.");
    }
    return { kind: "closed_unused", quoteId: args.quoteId, receipt: null };
  }, { isolationLevel: "Serializable" });
}

// features/keystone/mutations/rideLifecycle.ts
var import_graphql5 = require("graphql");
var import_node_crypto5 = require("node:crypto");
var import_node_util3 = require("node:util");

// features/keystone/domain/tripState.ts
var import_graphql4 = require("graphql");
var tripTransitions = {
  start_en_route: { from: ["driver_assigned"], to: "driver_en_route" },
  arrive: { from: ["driver_en_route"], to: "driver_arrived" },
  start_trip: { from: ["driver_arrived"], to: "in_progress" },
  complete: { from: ["in_progress"], to: "completed" },
  cancel: { from: ["driver_assigned", "driver_en_route", "driver_arrived"], to: "cancelled" },
  no_show: { from: ["driver_arrived"], to: "no_show" }
};
function nextTripStatus(current, action) {
  const transition = tripTransitions[action];
  if (!transition || !transition.from.includes(current)) throw new import_graphql4.GraphQLError(`Trip cannot transition from ${current} via ${action}.`);
  return transition.to;
}
function timestampFieldForStatus(status) {
  return { driver_en_route: "enRouteAt", driver_arrived: "arrivedAt", in_progress: "startedAt", completed: "completedAt", cancelled: "cancelledAt" }[status];
}

// features/keystone/domain/availability.ts
function localParts(at, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value.weekday);
  return day < 0 ? null : { day, minutes: Number(value.hour) * 60 + Number(value.minute) };
}
function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
function isDriverAvailableAt(rules, exceptions, at) {
  if (!Number.isFinite(at.getTime())) return false;
  const covering = exceptions.filter((item) => {
    const start = new Date(item.startsAt).getTime();
    const end = new Date(item.endsAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && start <= at.getTime() && end > at.getTime();
  });
  if (covering.some((item) => item.kind === "blocked")) return false;
  if (covering.some((item) => item.kind === "available")) return true;
  return rules.some((rule) => {
    if (rule.status !== "active") return false;
    const effectiveFrom = rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : Number.NEGATIVE_INFINITY;
    const effectiveUntil = rule.effectiveUntil ? new Date(rule.effectiveUntil).getTime() : Number.POSITIVE_INFINITY;
    if (rule.effectiveFrom && !Number.isFinite(effectiveFrom) || rule.effectiveUntil && !Number.isFinite(effectiveUntil) || at.getTime() < effectiveFrom || at.getTime() >= effectiveUntil) return false;
    const timezone = rule.timezone || "UTC";
    let local;
    try {
      local = localParts(at, timezone);
    } catch {
      return false;
    }
    if (!local) return false;
    const start = parseTime(rule.startTime);
    const end = parseTime(rule.endTime);
    if (rule.dayOfWeek === null || rule.dayOfWeek === void 0 || start === null || end === null || start === end) return false;
    if (start < end) return rule.dayOfWeek === local.day && local.minutes >= start && local.minutes < end;
    const previousDay = (local.day + 6) % 7;
    return rule.dayOfWeek === local.day && local.minutes >= start || rule.dayOfWeek === previousDay && local.minutes < end;
  });
}

// features/keystone/domain/currentAvailability.ts
async function isCurrentlyAvailableAt(db, driverId, at) {
  const [rules, exceptions] = await Promise.all([
    db.availabilityRule.findMany({ where: { driverId, status: "active", AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: at } }] }, { OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: at } }] }] }, orderBy: { id: "asc" }, take: 1001 }),
    db.availabilityException.findMany({ where: { driverId, startsAt: { lte: at }, endsAt: { gt: at } }, orderBy: { id: "asc" }, take: 1001 })
  ]);
  if (rules.length > 1e3 || exceptions.length > 1e3) throw new Error("Applicable driver availability is incomplete; reconcile the schedule before dispatch.");
  return isDriverAvailableAt(rules, exceptions, at);
}

// features/keystone/mutations/rideLifecycle.ts
init_access();

// features/keystone/domain/tripAuthority.ts
init_access();
var tripAuthoritySelect = { id: true, fleetId: true, riderId: true, requestId: true, acceptedOfferId: true, driverId: true, vehicleId: true };
function sameTripAuthority(a, b) {
  return a.id === b.id && a.fleetId === b.fleetId && a.riderId === b.riderId && a.requestId === b.requestId && a.acceptedOfferId === b.acceptedOfferId && a.driverId === b.driverId && a.vehicleId === b.vehicleId;
}
async function authorizedTripHeader(db, session2, tripId, purpose, capability = "operations") {
  const actor = await currentHumanActor(db, session2);
  if (!actor) return null;
  const header = await db.trip.findUnique({ where: { id: tripId }, select: tripAuthoritySelect });
  if (!header?.fleetId) return null;
  const fleet = await db.fleet.findUnique({ where: { id: header.fleetId }, select: { id: true } });
  if (fleet?.id !== header.fleetId) return null;
  const operator = purpose !== "reviewParticipant" && await canAccessFleet({ prisma: db }, session2, header.fleetId, capability);
  const driver = header.driverId ? await db.driverProfile.findUnique({ where: { id: header.driverId }, select: { id: true, userId: true, fleetId: true, status: true } }) : null;
  const assignedDriver = Boolean(["participant", "driverOrOperator", "reviewParticipant"].includes(purpose) && driver && driver.userId === actor.id && driver.status === "active" && driver.fleetId === header.fleetId);
  const rider = ["participant", "riderOrOperator", "reviewParticipant"].includes(purpose) && header.riderId === actor.id;
  if (!operator && !assignedDriver && !rider) return null;
  const request = header.requestId ? await db.rideRequest.findUnique({ where: { id: header.requestId }, select: {
    id: true,
    fleetId: true,
    riderId: true,
    trip: { select: { id: true } },
    quote: { select: { requestId: true, service: { select: { fleetId: true } } } }
  } }) : null;
  const offer = header.acceptedOfferId ? await db.matchOffer.findUnique({ where: { id: header.acceptedOfferId }, select: {
    id: true,
    requestId: true,
    driverId: true,
    vehicleId: true
  } }) : null;
  const vehicle = header.vehicleId ? await db.vehicle.findUnique({ where: { id: header.vehicleId }, select: { id: true, fleetId: true } }) : null;
  const bound = Boolean(request && request.id === header.requestId && request.trip?.id === header.id && request.fleetId === header.fleetId && request.riderId === header.riderId && request.quote?.requestId === request.id && request.quote.service?.fleetId === header.fleetId && offer && offer.id === header.acceptedOfferId && offer.requestId === header.requestId && offer.driverId === header.driverId && offer.vehicleId === header.vehicleId && driver && driver.id === header.driverId && driver.fleetId === header.fleetId && vehicle && vehicle.id === header.vehicleId && vehicle.fleetId === header.fleetId);
  return { header, actorId: actor.id, operator, assignedDriver, rider, bound };
}
function tripAuthorityWhere(header) {
  return {
    ...header,
    request: { is: {
      id: header.requestId || "",
      fleetId: header.fleetId,
      riderId: header.riderId,
      quote: { is: { requestId: header.requestId, service: { is: { fleetId: header.fleetId } } } }
    } },
    acceptedOffer: { is: { id: header.acceptedOfferId || "", requestId: header.requestId, driverId: header.driverId, vehicleId: header.vehicleId } },
    driver: { is: { id: header.driverId || "", fleetId: header.fleetId } },
    vehicle: { is: { id: header.vehicleId || "", fleetId: header.fleetId } }
  };
}

// features/keystone/domain/driverDispatchPresence.ts
var ACTIVE_TRIP_STATUSES = ["driver_assigned", "driver_en_route", "driver_arrived", "in_progress"];
var IN_PROGRESS_TRIP_STATUSES = ["driver_en_route", "driver_arrived", "in_progress"];
var PRESENT_DISPATCH_STATUSES = ["available", "offered", "assigned", "on_trip"];
async function refreshDriverPresentDispatchStatus(tx, driverId, now = /* @__PURE__ */ new Date()) {
  const [presentTrip, immediateOffer] = await Promise.all([
    tx.trip.findFirst({
      where: {
        driverId,
        status: { in: ACTIVE_TRIP_STATUSES },
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } },
          { status: { in: IN_PROGRESS_TRIP_STATUSES } }
        ]
      },
      orderBy: { acceptedAt: "desc" },
      select: { status: true }
    }),
    tx.matchOffer.findFirst({
      where: {
        driverId,
        status: "offered",
        expiresAt: { gt: now },
        reservationReleasedAt: null,
        request: { requestedFor: null }
      },
      select: { id: true }
    })
  ]);
  const dispatchStatus = presentTrip ? IN_PROGRESS_TRIP_STATUSES.includes(presentTrip.status || "") ? "on_trip" : "assigned" : immediateOffer ? "offered" : "available";
  await tx.driverProfile.updateMany({
    where: { id: driverId, status: "active", dispatchStatus: { in: PRESENT_DISPATCH_STATUSES } },
    data: { dispatchStatus }
  });
}

// features/keystone/domain/dispatchSchedule.ts
var FIXED_DISPATCH_RESERVATION_WINDOW_MS = 2 * 60 * 60 * 1e3;
function timeOf(value) {
  if (value == null) return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
function isFutureScheduledRequest(requestedFor, now) {
  const scheduledAt = timeOf(requestedFor);
  const nowAt = now.getTime();
  return Number.isFinite(scheduledAt) && Number.isFinite(nowAt) && scheduledAt > nowAt;
}
var LATE_SCHEDULED_GRACE_MS = 60 * 6e4;
function isLateScheduledRequest(requestedFor, now) {
  const scheduledAt = timeOf(requestedFor);
  const nowAt = now.getTime();
  return Number.isFinite(scheduledAt) && Number.isFinite(nowAt) && scheduledAt <= nowAt && nowAt - scheduledAt < LATE_SCHEDULED_GRACE_MS;
}
function overlapsFixedDispatchWindow(proposedStart, existingStart, windowMs = FIXED_DISPATCH_RESERVATION_WINDOW_MS) {
  const proposedAt = timeOf(proposedStart);
  const existingAt = timeOf(existingStart);
  if (!Number.isFinite(proposedAt) || !Number.isFinite(existingAt) || !Number.isFinite(windowMs) || windowMs <= 0) return true;
  const proposedEnd = proposedAt + windowMs;
  const existingEnd = existingAt + windowMs;
  if (!Number.isFinite(proposedEnd) || !Number.isFinite(existingEnd)) return true;
  return proposedAt < existingEnd && existingAt < proposedEnd;
}

// features/keystone/domain/eligibility.ts
function isCurrentEligibility(evaluation, kind, fleetId, now) {
  if (!evaluation || evaluation.outcome !== "eligible" || evaluation.policy?.status !== "active" || evaluation.policy.kind !== kind || (evaluation.policy.fleetId ?? evaluation.policy.fleet?.id) !== fleetId) return false;
  if (!Number.isFinite(now.getTime())) return false;
  return !evaluation.expiresAt || new Date(evaluation.expiresAt).getTime() > now.getTime();
}
async function loadCurrentEligibility(db, subject, subjectId, fleetId, now) {
  const kind = `${subject}_eligibility`;
  const policies = await db.policy.findMany({ where: { fleetId, kind, status: "active" }, orderBy: { id: "asc" }, take: 2, select: { id: true, version: true } });
  if (policies.length !== 1) return false;
  const evaluation = await db.policyEvaluation.findFirst({
    where: { policyId: policies[0].id, [`${subject}Id`]: subjectId, [subject === "driver" ? "vehicleId" : "driverId"]: null },
    orderBy: [{ evaluatedAt: "desc" }, { id: "desc" }],
    include: { policy: true }
  });
  const recordedVersion = evaluation?.evidenceSnapshot && !Array.isArray(evaluation.evidenceSnapshot) ? evaluation.evidenceSnapshot.policyVersion : null;
  return recordedVersion === policies[0].version && isCurrentEligibility(evaluation, kind, fleetId, now) ? evaluation : null;
}

// features/keystone/mutations/offerMaintenance.ts
init_access();
async function expireRideOffers(_root, args, context) {
  return releaseElapsedOffers(context.prisma, args, async (tx) => {
    await fenceHumanAuthority(tx, context.session, args.fleetId);
    if (!await canAccessFleet({ prisma: tx }, context.session, args.fleetId, "operations")) throw new Error("Fleet is unavailable.");
  });
}
async function releaseElapsedOffers(prisma, args, authorize) {
  return prisma.$transaction(async (tx) => {
    if (authorize) await authorize(tx);
    const now = /* @__PURE__ */ new Date();
    const rows = await tx.matchOffer.findMany({
      where: {
        status: "offered",
        expiresAt: { lte: now },
        reservationReleasedAt: null,
        request: { is: { fleetId: args.fleetId } },
        driver: { is: { fleetId: args.fleetId } },
        vehicle: { is: { fleetId: args.fleetId } },
        ...args.requestId ? { requestId: args.requestId } : {},
        ...args.driverId || args.vehicleId ? { OR: [...args.driverId ? [{ driverId: args.driverId }] : [], ...args.vehicleId ? [{ vehicleId: args.vehicleId }] : []] } : {}
      },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: 51,
      select: { id: true, driverId: true, requestId: true, vehicleId: true }
    });
    const batch = rows.slice(0, 50);
    const keys = [...new Set(batch.flatMap((row) => [`driver:${row.driverId}`, `offer:${row.id}`, `request:${row.requestId}`, `vehicle:${row.vehicleId}`]))].sort();
    for (const key of keys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text IS NOT NULL`;
    let releasedCount = 0;
    for (const row of batch) {
      const result = await tx.matchOffer.updateMany({ where: { ...row, status: "offered", expiresAt: { lte: now }, reservationReleasedAt: null }, data: { status: "expired", reservationReleasedAt: now, respondedAt: now } });
      releasedCount += result.count;
    }
    for (const driverId of [...new Set(batch.map((row) => row.driverId).filter(Boolean))].sort()) await refreshDriverPresentDispatchStatus(tx, driverId, now);
    return { releasedCount, hasMore: rows.length > 50 };
  }, { isolationLevel: "Serializable" });
}
async function expireRequestFleetOffers(_root, args, context) {
  const header = await context.prisma.rideRequest.findUnique({ where: { id: args.requestId }, select: { fleetId: true } });
  if (!header?.fleetId) throw new Error("Request is unavailable.");
  return expireRideOffers(null, { fleetId: header.fleetId }, context);
}

// features/keystone/domain/tripEconomics.ts
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function requireAcceptedQuoteFee(bookingSnapshot, requestQuoteSnapshot, field) {
  const tripQuote = record(record(bookingSnapshot)?.quote);
  const requestQuote = record(requestQuoteSnapshot);
  const feeMinor = tripQuote?.[field];
  const currencyCode = tripQuote?.currencyCode;
  const requestFeeMinor = requestQuote?.[field];
  const requestCurrencyCode = requestQuote?.currencyCode;
  if (typeof feeMinor !== "number" || !Number.isSafeInteger(feeMinor) || feeMinor < 0 || typeof currencyCode !== "string" || !/^[A-Z]{3}$/.test(currencyCode) || typeof requestFeeMinor !== "number" || !Number.isSafeInteger(requestFeeMinor) || requestFeeMinor < 0 || typeof requestCurrencyCode !== "string" || !/^[A-Z]{3}$/.test(requestCurrencyCode) || feeMinor !== requestFeeMinor || currencyCode !== requestCurrencyCode) {
    const label = field === "cancellationFeeMinor" ? "Cancellation" : "No-show";
    throw new Error(`${label} fee evidence is missing, invalid, or inconsistent with the accepted request quote; manual review is required.`);
  }
  return { feeMinor, currencyCode };
}

// features/keystone/mutations/rideLifecycle.ts
async function requireSignedIn(context) {
  const actor = await currentHumanActor(context.prisma, context.session);
  if (!actor) throw new import_graphql5.GraphQLError("A current human User session is required.");
  return actor.id;
}
async function operatorOwnsFleet(context, fleetId) {
  return canAccessFleet(context, context.session, fleetId, "operations");
}
async function currentDriver(context) {
  const profiles = await context.sudo().query.DriverProfile.findMany({ where: { user: { id: { equals: context.session?.itemId } } }, take: 1, query: "id fleet { id } status dispatchStatus" });
  return profiles[0] || null;
}
async function offerRideToDriver(_root, args, context) {
  const actorId = await requireSignedIn(context);
  if (args.expectedActorId !== actorId) throw new import_graphql5.GraphQLError("The acting account changed; reconcile the original command.");
  if (args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 200) throw new import_graphql5.GraphQLError("A stable idempotency key of 12\u2013200 characters is required.");
  if (args.expiresInSeconds != null && !Number.isSafeInteger(args.expiresInSeconds)) throw new import_graphql5.GraphQLError("Offer duration must be an integer.");
  const prisma = context.prisma;
  const visibleRequest = await prisma.rideRequest.findUnique({ where: { id: args.requestId }, select: { id: true, fleetId: true } });
  if (!visibleRequest?.fleetId || !await operatorOwnsFleet(context, visibleRequest.fleetId)) throw new import_graphql5.GraphQLError("Ride request was not found.");
  await requireFleetOperations(prisma, visibleRequest.fleetId);
  const existingOffer = await prisma.matchOffer.findUnique({ where: { idempotencyKey: args.idempotencyKey }, select: { id: true } });
  if (!existingOffer) {
    const maintenance = await expireRideOffers(null, { fleetId: visibleRequest.fleetId, driverId: args.driverId, vehicleId: args.vehicleId }, context);
    if (maintenance.hasMore) throw new import_graphql5.GraphQLError("More expired reservations require release before new dispatch.");
  }
  return placeRideOffer(prisma, args, {
    actorId,
    authorize: async (tx, fleetId) => {
      await fenceHumanAuthority(tx, context.session, fleetId);
      return canAccessFleet({ prisma: tx }, context.session, fleetId, "operations");
    }
  });
}
async function placeRideOffer(prisma, args, authority) {
  const visibleRequest = await prisma.rideRequest.findUnique({ where: { id: args.requestId }, select: { id: true, fleetId: true } });
  if (!visibleRequest?.fleetId) throw new import_graphql5.GraphQLError("Ride request was not found.");
  const actorId = authority.actorId;
  return prisma.$transaction(async (tx) => {
    const lockKeys = [`driver:${args.driverId}`, `request:${args.requestId}`, `vehicle:${args.vehicleId}`].sort();
    for (const key of lockKeys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text IS NOT NULL`;
    if (!await authority.authorize(tx, visibleRequest.fleetId)) throw new import_graphql5.GraphQLError("Ride request was not found.");
    const header = await tx.rideRequest.findUnique({ where: { id: args.requestId }, select: { id: true, fleetId: true } });
    if (!header?.fleetId || header.fleetId !== visibleRequest.fleetId) throw new import_graphql5.GraphQLError("Ride request was not found.");
    const driverHeader = await tx.driverProfile.findUnique({ where: { id: args.driverId }, select: { id: true, fleetId: true } });
    const vehicleHeader = await tx.vehicle.findUnique({ where: { id: args.vehicleId }, select: { id: true, fleetId: true } });
    if (driverHeader?.fleetId !== header.fleetId || vehicleHeader?.fleetId !== header.fleetId) throw new import_graphql5.GraphQLError("Driver or vehicle lacks current fleet-bound eligibility evidence.");
    const dispatchCommand = { version: 1, purpose: "dispatch_offer", actorId, fleetId: header.fleetId, requestId: args.requestId, driverId: args.driverId, vehicleId: args.vehicleId, expiresInSeconds: args.expiresInSeconds ?? null };
    const replayHeader = await tx.matchOffer.findUnique({ where: { idempotencyKey: args.idempotencyKey }, select: { id: true, requestId: true, driverId: true, vehicleId: true } });
    if (replayHeader) {
      if (replayHeader.requestId !== header.id || replayHeader.driverId !== args.driverId || replayHeader.vehicleId !== args.vehicleId) throw new import_graphql5.GraphQLError("Idempotency key was already used for another dispatch command.");
      const replay = await tx.matchOffer.findUnique({ where: { id: replayHeader.id } });
      const snapshot = replay?.eligibilitySnapshot;
      if (!replay || !(0, import_node_util3.isDeepStrictEqual)(snapshot?.dispatchCommand, dispatchCommand)) throw new import_graphql5.GraphQLError("Original dispatch actor/purpose/body binding is unavailable or different; reconcile the retained offer, not a replacement key.");
      return replay;
    }
    const [request, driver] = await Promise.all([
      tx.rideRequest.findFirst({ where: { id: header.id, fleetId: header.fleetId }, include: { quote: { include: { service: true } } } }),
      tx.driverProfile.findFirst({ where: { id: args.driverId, fleetId: header.fleetId }, include: { vehicles: { where: { id: args.vehicleId, fleetId: header.fleetId }, include: { drivers: { where: { id: args.driverId }, select: { id: true } }, policyEvaluations: { orderBy: { evaluatedAt: "desc" }, take: 1, include: { policy: true } } } }, policyEvaluations: { orderBy: { evaluatedAt: "desc" }, take: 1, include: { policy: true } } } })
    ]);
    if (!request) throw new import_graphql5.GraphQLError("Ride request was not found.");
    if (!["requested", "matching"].includes(request.status || "")) throw new import_graphql5.GraphQLError("Ride request is not matchable.");
    if (authority.onlyOffer && await tx.matchOffer.findFirst({ where: { requestId: request.id, OR: [{ status: "accepted" }, { status: "offered", expiresAt: { gt: /* @__PURE__ */ new Date() }, reservationReleasedAt: null }] }, select: { id: true } })) throw new import_graphql5.GraphQLError("This request already has a live offer.");
    await requireServiceReadiness(tx, request.quote?.serviceId || null, request.fleetId);
    const service = request.quote?.service;
    if (!service || service.status !== "active") throw new import_graphql5.GraphQLError("The quoted service is no longer active.");
    const vehicle = driver?.vehicles[0];
    const dispatchNow = /* @__PURE__ */ new Date();
    const driverEligible = request.fleetId && await loadCurrentEligibility(tx, "driver", args.driverId, request.fleetId, dispatchNow);
    const vehicleEligible = request.fleetId && await loadCurrentEligibility(tx, "vehicle", args.vehicleId, request.fleetId, dispatchNow);
    const freshPresence = await tx.driverProfile.findUnique({ where: { id: args.driverId }, select: { dispatchStatus: true } });
    const isFutureScheduled = isFutureScheduledRequest(request.requestedFor, dispatchNow);
    const requestedAt = isFutureScheduled ? request.requestedFor : dispatchNow;
    const dispatchStateAllowsRequest = isFutureScheduled ? ["available", "offered", "assigned", "on_trip"].includes(freshPresence?.dispatchStatus || "") : freshPresence?.dispatchStatus === "available";
    if (!driver || driver.fleetId !== request.fleetId || driver.status !== "active" || !dispatchStateAllowsRequest || !driverEligible || !vehicle || vehicle.status !== "active" || vehicle.fleetId !== request.fleetId || vehicle.drivers.length === 0 || !vehicleEligible) {
      throw new import_graphql5.GraphQLError("Driver or vehicle lacks current fleet-bound eligibility evidence.");
    }
    const accessibilityNeeds = request.accessibilityNeeds && typeof request.accessibilityNeeds === "object" && !Array.isArray(request.accessibilityNeeds) ? request.accessibilityNeeds : {};
    if ((request.passengerCount || 1) > (service.passengerCapacity || 0) || (request.passengerCount || 1) > (vehicle.capacity || 0) || service.wheelchairAccessible && !vehicle.wheelchairAccessible || accessibilityNeeds.wheelchairAccessible === true && !vehicle.wheelchairAccessible) throw new import_graphql5.GraphQLError("The selected vehicle does not meet this service request.");
    if (request.requestedFor && (isFutureScheduled ? !driver.acceptsScheduled : !isLateScheduledRequest(request.requestedFor, dispatchNow))) throw new import_graphql5.GraphQLError("This driver or service does not accept the requested schedule.");
    if (!await isCurrentlyAvailableAt(tx, driver.id, requestedAt)) throw new import_graphql5.GraphQLError("Driver is not available for the requested time.");
    const activeTrips = await tx.trip.findMany({ where: { status: { in: ["driver_assigned", "driver_en_route", "driver_arrived", "in_progress"] }, OR: [{ driverId: driver.id }, { vehicleId: vehicle.id }] }, select: { driverId: true, vehicleId: true, scheduledFor: true, acceptedAt: true } });
    if (activeTrips.some((trip) => overlapsFixedDispatchWindow(requestedAt, trip.scheduledFor || trip.acceptedAt))) throw new import_graphql5.GraphQLError("Driver or vehicle already has an overlapping active reservation.");
    const outstandingOffers = await tx.matchOffer.findMany({ where: { status: { in: ["offered", "accepted"] }, reservationReleasedAt: null, OR: [{ driverId: driver.id }, { vehicleId: vehicle.id }] }, select: { reservationStartAt: true } });
    if (outstandingOffers.some((item) => overlapsFixedDispatchWindow(requestedAt, item.reservationStartAt))) throw new import_graphql5.GraphQLError("Driver or vehicle already has an overlapping offer reservation.");
    const expiresAt = new Date(Date.now() + Math.max(30, Math.min(Number(args.expiresInSeconds) || 90, 600)) * 1e3);
    const offer = await tx.matchOffer.create({ data: { requestId: request.id, driverId: driver.id, vehicleId: vehicle.id, reservationStartAt: requestedAt, expiresAt, idempotencyKey: args.idempotencyKey, eligibilitySnapshot: { dispatchCommand, evaluatedAt: (/* @__PURE__ */ new Date()).toISOString(), driverPolicyId: driverEligible.policyId, driverPolicyVersion: driverEligible.policy.version, vehiclePolicyId: vehicleEligible.policyId, vehiclePolicyVersion: vehicleEligible.policy.version, driverEvaluationId: driverEligible.id, vehicleEvaluationId: vehicleEligible.id } } });
    const requestUpdate = await tx.rideRequest.updateMany({ where: { id: request.id, status: { in: ["requested", "matching"] } }, data: { status: "matching" } });
    const driverUpdate = isFutureScheduled ? { count: 1 } : await tx.driverProfile.updateMany({ where: { id: driver.id, status: "active", dispatchStatus: "available" }, data: { dispatchStatus: "offered" } });
    if (requestUpdate.count !== 1 || driverUpdate.count !== 1) throw new import_graphql5.GraphQLError("Dispatch reservation changed concurrently; reconcile the original command before retrying.");
    return offer;
  }, { isolationLevel: "ReadCommitted" });
}
async function respondToRideOffer(_root, args, context) {
  const actorId = await requireSignedIn(context);
  if (context.session.listKey !== "User" || context.session.apiKeyScopes) throw new import_graphql5.GraphQLError("A driver User session is required.");
  if (!["accept", "decline"].includes(args.response)) throw new import_graphql5.GraphQLError("Response must be accept or decline.");
  const responseReason = String(args.reason || "").slice(0, 500);
  const driver = await currentDriver(context);
  if (!driver) throw new import_graphql5.GraphQLError("An active driver profile is required.");
  await requireFleetOperations(context.prisma, driver.fleet?.id);
  if (args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 200) throw new import_graphql5.GraphQLError("A stable idempotency key of 12\u2013200 characters is required.");
  const prisma = context.prisma;
  const initial = await prisma.matchOffer.findUnique({ where: { id: args.offerId }, select: { requestId: true, driverId: true, vehicleId: true } });
  if (!initial || initial.driverId !== driver.id) throw new import_graphql5.GraphQLError("Offer was not found.");
  const siblingSnapshots = initial.requestId ? await prisma.matchOffer.findMany({ where: { requestId: initial.requestId, id: { not: args.offerId }, status: "offered" }, select: { driverId: true } }) : [];
  const lockedDriverIds = new Set([initial.driverId, ...siblingSnapshots.map((item) => item.driverId)].filter((id) => Boolean(id)));
  const lockKeys = [
    ...Array.from(lockedDriverIds, (id) => `driver:${id}`),
    `offer:${args.offerId}`,
    `request:${initial.requestId || ""}`,
    `vehicle:${initial.vehicleId || ""}`
  ].sort();
  return prisma.$transaction(async (tx) => {
    for (const key of lockKeys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text IS NOT NULL`;
    const lockedInitial = await tx.matchOffer.findUnique({ where: { id: args.offerId }, select: { requestId: true, driverId: true, vehicleId: true } });
    if (!lockedInitial || lockedInitial.driverId !== initial.driverId || lockedInitial.requestId !== initial.requestId || lockedInitial.vehicleId !== initial.vehicleId) throw new import_graphql5.GraphQLError("Offer changed concurrently; reload before retrying.");
    await fenceHumanAuthority(tx, context.session, driver.fleet?.id);
    const actingActor = await currentHumanActor(tx, context.session);
    const actingDriver = await tx.driverProfile.findUnique({ where: { id: driver.id }, select: { userId: true, status: true, fleetId: true } });
    const requestHeader = lockedInitial.requestId ? await tx.rideRequest.findUnique({ where: { id: lockedInitial.requestId }, select: { id: true, fleetId: true } }) : null;
    const vehicleHeader = lockedInitial.vehicleId ? await tx.vehicle.findUnique({ where: { id: lockedInitial.vehicleId }, select: { id: true, fleetId: true } }) : null;
    const fleetHeader = requestHeader?.fleetId ? await tx.fleet.findUnique({ where: { id: requestHeader.fleetId }, select: { id: true } }) : null;
    if (actingActor?.id !== actorId || actingDriver?.userId !== actorId || actingDriver.status !== "active" || !requestHeader?.fleetId || fleetHeader?.id !== requestHeader.fleetId || actingDriver.fleetId !== requestHeader.fleetId || vehicleHeader?.fleetId !== requestHeader.fleetId) throw new import_graphql5.GraphQLError("Offer was not found or driver authority changed.");
    const offer = await tx.matchOffer.findFirst({ where: { id: args.offerId, driverId: driver.id, requestId: requestHeader.id, vehicleId: lockedInitial.vehicleId, request: { is: { id: requestHeader.id, fleetId: requestHeader.fleetId } }, vehicle: { is: { fleetId: requestHeader.fleetId } } }, include: { request: { include: { quote: { include: { service: true } }, trip: true } }, vehicle: true } });
    if (!offer?.request || !offer.vehicle || !hasRequestQuoteBinding(offer.request)) throw new import_graphql5.GraphQLError("Offer was not found or driver authority changed.");
    if (offer.status !== "offered") {
      if (offer.status === "accepted") {
        const replay = await tx.tripEvent.findUnique({ where: { idempotencyKey: args.idempotencyKey }, include: { trip: { include: { acceptedOffer: true } } } });
        const metadata = replay?.metadata || {};
        if (args.response === "accept" && replay?.trip && ["trip.driver_assigned", "trip.driver_reassigned"].includes(replay.eventType || "") && replay.actorType === "driver" && replay.actorUserId === actorId && metadata.offerId === offer.id && metadata.response === "accept" && (metadata.reason || "") === responseReason && metadata.requestId === offer.request.id && metadata.fleetId === offer.request.fleetId && replay.trip.acceptedOfferId === offer.id && offer.request.trip?.id === replay.tripId && offer.request.status === "matched" && hasRequestTripBinding(offer.request, replay.trip)) return { accepted: true, requestId: offer.request.id, tripId: replay.tripId, confirmationCode: replay.trip?.confirmationCode || null, tripToken: null };
      }
      const snapshot = offer.eligibilitySnapshot || {};
      const command = snapshot.responseCommand;
      if (["declined", "expired"].includes(offer.status || "") && command?.idempotencyKey === args.idempotencyKey && command.actorId === actorId && command.response === args.response && command.reason === responseReason) return { accepted: false, requestId: offer.request.id, tripId: null, confirmationCode: null, tripToken: null };
      throw new import_graphql5.GraphQLError("Offer is no longer active or the response key does not match its recorded outcome.");
    }
    if (offer.expiresAt <= /* @__PURE__ */ new Date()) {
      await tx.matchOffer.update({ where: { id: offer.id }, data: { status: "expired", respondedAt: /* @__PURE__ */ new Date(), reservationReleasedAt: /* @__PURE__ */ new Date(), eligibilitySnapshot: { ...offer.eligibilitySnapshot || {}, responseCommand: { idempotencyKey: args.idempotencyKey, actorId, response: args.response, reason: responseReason } } } });
      await refreshDriverPresentDispatchStatus(tx, driver.id);
      return { accepted: false, requestId: offer.request.id, tripId: null, confirmationCode: null, tripToken: null };
    }
    if (args.response === "decline") {
      await tx.matchOffer.update({ where: { id: offer.id }, data: { status: "declined", respondedAt: /* @__PURE__ */ new Date(), reservationReleasedAt: /* @__PURE__ */ new Date(), declineReason: responseReason, eligibilitySnapshot: { ...offer.eligibilitySnapshot || {}, responseCommand: { idempotencyKey: args.idempotencyKey, actorId, response: "decline", reason: responseReason } } } });
      await refreshDriverPresentDispatchStatus(tx, driver.id);
      return { accepted: false, requestId: offer.request.id, tripId: null, confirmationCode: null, tripToken: null };
    }
    if (args.response !== "accept") throw new import_graphql5.GraphQLError("Response must be accept or decline.");
    await requireServiceReadiness(tx, offer.request.quote?.serviceId || null, offer.request.fleetId);
    if (offer.request.status !== "matching" || !offer.vehicleId || offer.request.trip && offer.request.trip.status !== "cancelled") throw new import_graphql5.GraphQLError("Ride request has already been resolved.");
    const [currentState, acceptedVehicle] = await Promise.all([
      tx.driverProfile.findUnique({ where: { id: driver.id }, include: { policyEvaluations: { orderBy: { evaluatedAt: "desc" }, take: 1, include: { policy: true } } } }),
      tx.vehicle.findUnique({ where: { id: offer.vehicleId }, include: { drivers: { where: { id: driver.id }, select: { id: true } }, policyEvaluations: { orderBy: { evaluatedAt: "desc" }, take: 1, include: { policy: true } } } })
    ]);
    const now = /* @__PURE__ */ new Date();
    const requestFleetId = offer.request.fleetId;
    const driverEligible = requestFleetId && await loadCurrentEligibility(tx, "driver", driver.id, requestFleetId, now);
    const vehicleEligible = requestFleetId && await loadCurrentEligibility(tx, "vehicle", offer.vehicleId, requestFleetId, now);
    const isFutureScheduled = isFutureScheduledRequest(offer.request.requestedFor, now);
    const dispatchStateAllowsAcceptance = isFutureScheduled ? ["available", "offered", "assigned", "on_trip"].includes(currentState?.dispatchStatus || "") : currentState?.dispatchStatus === "offered";
    if (!currentState || currentState.status !== "active" || !dispatchStateAllowsAcceptance || currentState.fleetId !== offer.request.fleetId || !driverEligible || !acceptedVehicle || acceptedVehicle.status !== "active" || acceptedVehicle.fleetId !== offer.request.fleetId || acceptedVehicle.drivers.length === 0 || !vehicleEligible) throw new import_graphql5.GraphQLError("Driver or vehicle eligibility changed after the offer was made.");
    const service = offer.request.quote?.service;
    const needs = offer.request.accessibilityNeeds && typeof offer.request.accessibilityNeeds === "object" && !Array.isArray(offer.request.accessibilityNeeds) ? offer.request.accessibilityNeeds : {};
    if (!service || service.status !== "active") throw new import_graphql5.GraphQLError("The quoted service is no longer active.");
    if ((offer.request.passengerCount || 1) > (acceptedVehicle.capacity || 0) || (offer.request.passengerCount || 1) > (service.passengerCapacity || 0) || service.wheelchairAccessible && !acceptedVehicle.wheelchairAccessible || needs.wheelchairAccessible === true && !acceptedVehicle.wheelchairAccessible) throw new import_graphql5.GraphQLError("The assigned vehicle no longer meets the quoted service requirements.");
    if (offer.request.requestedFor && (isFutureScheduled ? !currentState.acceptsScheduled : !isLateScheduledRequest(offer.request.requestedFor, now))) throw new import_graphql5.GraphQLError("Driver or service schedule eligibility changed.");
    const acceptanceTime = isFutureScheduled ? offer.request.requestedFor : now;
    if (!await isCurrentlyAvailableAt(tx, driver.id, acceptanceTime)) throw new import_graphql5.GraphQLError("Driver is no longer available for the requested time.");
    const reservations = await tx.trip.findMany({ where: { status: { in: ["driver_assigned", "driver_en_route", "driver_arrived", "in_progress"] }, OR: [{ driverId: driver.id }, { vehicleId: acceptedVehicle.id }] }, select: { scheduledFor: true, acceptedAt: true } });
    if (reservations.some((item) => overlapsFixedDispatchWindow(acceptanceTime, item.scheduledFor || item.acceptedAt))) throw new import_graphql5.GraphQLError("Driver or vehicle already has an overlapping active reservation.");
    const isReassignment = offer.request.trip?.status === "cancelled";
    const confirmationCode = offer.request.trip?.confirmationCode || `TRIP-${(0, import_node_crypto5.randomUUID)().slice(0, 8).toUpperCase()}`;
    const acceptedAt = /* @__PURE__ */ new Date();
    if (offer.expiresAt <= acceptedAt) throw new import_graphql5.GraphQLError("Offer lease expired before assignment; recover the original response, not a new command.");
    const requestClaim = await tx.rideRequest.updateMany({ where: { id: offer.request.id, status: "matching" }, data: { status: "matched" } });
    if (requestClaim.count !== 1) throw new import_graphql5.GraphQLError("Ride request was resolved concurrently; refresh before retrying.");
    const offerClaim = await tx.matchOffer.updateMany({ where: { id: offer.id, requestId: offer.request.id, driverId: driver.id, status: "offered", expiresAt: { gt: acceptedAt } }, data: { status: "accepted", reservationStartAt: isFutureScheduled ? offer.request.requestedFor : acceptedAt, respondedAt: acceptedAt, eligibilitySnapshot: { ...offer.eligibilitySnapshot || {}, responseCommand: { idempotencyKey: args.idempotencyKey, actorId: context.session.itemId, response: "accept" } } } });
    if (offerClaim.count !== 1) throw new import_graphql5.GraphQLError("Offer was withdrawn or answered concurrently.");
    const tripData = {
      fleetId: offer.request.fleetId,
      riderId: offer.request.riderId,
      driverId: driver.id,
      vehicleId: offer.vehicleId,
      requestId: offer.request.id,
      acceptedOfferId: offer.id,
      confirmationCode,
      status: "driver_assigned",
      scheduledFor: offer.request.requestedFor,
      acceptedAt,
      cancelledAt: null,
      enRouteAt: null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      pickupLabel: offer.request.pickupLabel,
      dropoffLabel: offer.request.dropoffLabel,
      bookingSnapshot: { assignmentGeneration: offer.id, acceptedAt: acceptedAt.toISOString(), acceptedOfferId: offer.id, requestId: offer.request.id, fleetId: offer.request.fleetId, quote: offer.request.quoteSnapshot, service: offer.request.quote?.service ? { id: offer.request.quote.service.id, name: offer.request.quote.service.name, category: offer.request.quote.service.category } : null, driver: { id: driver.id, publicName: currentState.publicName }, vehicle: { id: offer.vehicle.id, label: offer.vehicle.label, make: offer.vehicle.make, model: offer.vehicle.model, color: offer.vehicle.color, plateMasked: offer.vehicle.plateMasked } },
      // Acceptance never issues rider authority to a driver. Rider handoff is request-owned.
      // A reassignment preserves any historical driver-issued hash/expiry as evidence.
      managementTokenRevokedAt: offer.request.trip?.managementTokenRevokedAt || /* @__PURE__ */ new Date()
    };
    const trip = isReassignment ? await tx.trip.update({ where: { id: offer.request.trip.id }, data: tripData }) : await tx.trip.create({ data: { ...tripData, managementTokenHash: "", managementTokenExpiresAt: null } });
    await tx.tripEvent.create({ data: { tripId: trip.id, eventType: isReassignment ? "trip.driver_reassigned" : "trip.driver_assigned", fromStatus: isReassignment ? "cancelled" : "matching", toStatus: "driver_assigned", actorType: "driver", actorUserId: context.session.itemId, idempotencyKey: args.idempotencyKey, occurredAt: /* @__PURE__ */ new Date(), metadata: { offerId: offer.id, requestId: offer.request.id, fleetId: offer.request.fleetId, response: "accept", reason: responseReason, assignmentGeneration: offer.id, assignmentSnapshot: tripData.bookingSnapshot, previousAssignmentSnapshot: isReassignment ? offer.request.trip?.bookingSnapshot || null : null, riderHandoff: "request_receipt", notification: "not_requested" } } });
    const siblingOffers = await tx.matchOffer.findMany({ where: { requestId: offer.request.id, id: { not: offer.id }, status: "offered" }, select: { driverId: true } });
    const siblingDriverIds = [...new Set(siblingOffers.map((item) => item.driverId).filter((id) => Boolean(id)))].sort();
    if (siblingDriverIds.some((id) => !lockedDriverIds.has(id))) throw new import_graphql5.GraphQLError("Sibling offers changed concurrently; reload before retrying.");
    await tx.matchOffer.updateMany({ where: { requestId: offer.request.id, id: { not: offer.id }, status: "offered" }, data: { status: "withdrawn", respondedAt: /* @__PURE__ */ new Date(), reservationReleasedAt: /* @__PURE__ */ new Date() } });
    for (const siblingDriverId of siblingDriverIds) await refreshDriverPresentDispatchStatus(tx, siblingDriverId);
    if (!isFutureScheduled) await tx.driverProfile.update({ where: { id: driver.id }, data: { dispatchStatus: "assigned" } });
    return { accepted: true, requestId: offer.request.id, tripId: trip.id, confirmationCode, tripToken: null };
  }, { isolationLevel: "Serializable" });
}
async function transitionTrip(_root, args, context) {
  const actorId = await requireSignedIn(context);
  if (args.expectedActorId !== actorId) throw new import_graphql5.GraphQLError("The acting account changed; reconcile the original command.");
  if (args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 200) throw new import_graphql5.GraphQLError("A stable idempotency key of 12\u2013200 characters is required.");
  if (args.action === "cancel") throw new import_graphql5.GraphQLError("Use the cancellation workflow so the policy and fee decision are recorded consistently.");
  const reason = String(args.reason || "").slice(0, 500);
  const prisma = context.prisma;
  const initialAuthority = await authorizedTripHeader(prisma, context.session, args.tripId, "driverOrOperator");
  if (!initialAuthority) throw new import_graphql5.GraphQLError("You cannot transition this trip.");
  if (initialAuthority.header.acceptedOfferId !== args.expectedAcceptedOfferId) throw new import_graphql5.GraphQLError("Original trip assignment changed; reconciliation is required.");
  await requireFleetOperations(prisma, initialAuthority.header.fleetId);
  const lockSnapshot = initialAuthority.header;
  const lockKeys = [
    ...lockSnapshot.driverId ? [`driver:${lockSnapshot.driverId}`] : [],
    ...lockSnapshot.acceptedOfferId ? [`offer:${lockSnapshot.acceptedOfferId}`] : [],
    ...lockSnapshot.requestId ? [`request:${lockSnapshot.requestId}`] : [],
    `trip:${args.tripId}`
  ].sort();
  return prisma.$transaction(async (tx) => {
    for (const key of lockKeys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text IS NOT NULL`;
    await fenceHumanAuthority(tx, context.session, lockSnapshot.fleetId);
    const authority = await authorizedTripHeader(tx, context.session, args.tripId, "driverOrOperator");
    if (!authority) throw new import_graphql5.GraphQLError("You cannot transition this trip.");
    if (!sameTripAuthority(authority.header, lockSnapshot)) throw new import_graphql5.GraphQLError("Trip assignment changed concurrently; reload before retrying.");
    if (!authority.bound) throw new import_graphql5.GraphQLError("Trip request/assignment binding is unavailable; reconcile before transitioning.");
    const trip = await tx.trip.findFirst({ where: tripAuthorityWhere(authority.header), include: { request: { include: { quote: { include: { service: true } } } }, acceptedOffer: true } });
    if (!trip) throw new import_graphql5.GraphQLError("Trip not found.");
    const currentAssignedDriver = authority.assignedDriver;
    const actorType = currentAssignedDriver ? "driver" : "operator";
    const commandBinding = { version: 1, purpose: "trip_transition", actorType, ...authority.header };
    if (!trip.request || !hasRequestTripBinding(trip.request, trip)) throw new import_graphql5.GraphQLError("Trip request/assignment binding is unavailable; reconcile before transitioning.");
    const replay = await tx.tripEvent.findUnique({ where: { idempotencyKey: args.idempotencyKey } });
    if (replay) {
      const metadata = replay.metadata || {};
      if (replay.tripId !== trip.id || replay.actorUserId !== actorId || replay.actorType !== actorType || replay.eventType !== `trip.${replay.toStatus}` || metadata.action !== args.action || metadata.reason !== reason || !(0, import_node_util3.isDeepStrictEqual)(metadata.commandBinding, commandBinding)) throw new import_graphql5.GraphQLError("Idempotency key belongs to a different actor, trip, or command.");
      return { ...trip, status: replay.toStatus };
    }
    const next = nextTripStatus(trip.status || "", args.action);
    if (args.action === "start_en_route" && trip.scheduledFor && trip.scheduledFor.getTime() > Date.now() + 2 * 60 * 6e4) throw new import_graphql5.GraphQLError("A scheduled trip cannot start en route more than two hours early.");
    let noShowEconomics = null;
    if (args.action === "no_show") {
      if (trip.scheduledFor && trip.scheduledFor > /* @__PURE__ */ new Date()) throw new import_graphql5.GraphQLError("A future trip cannot be marked no-show.");
      if (!trip.arrivedAt || trip.arrivedAt.getTime() > Date.now() - 5 * 6e4) throw new import_graphql5.GraphQLError("The driver must wait at least five minutes after arrival before reporting a no-show.");
      if (!currentAssignedDriver) throw new import_graphql5.GraphQLError("Only the assigned driver may record a no-show.");
      noShowEconomics = requireAcceptedQuoteFee(trip.bookingSnapshot, trip.request?.quoteSnapshot, "noShowFeeMinor");
    }
    const timeField = timestampFieldForStatus(next);
    const snapshot = trip.bookingSnapshot;
    const quotedFare = snapshot?.quote;
    const finalFare = next === "completed" ? quotedFare || {} : void 0;
    const transitionTime = timeField ? { [timeField]: /* @__PURE__ */ new Date() } : {};
    const updated = await tx.trip.update({ where: { id: trip.id }, data: { status: next, ...transitionTime, ...finalFare ? { finalFareSnapshot: finalFare } : {} } });
    await tx.tripEvent.create({ data: { tripId: trip.id, eventType: `trip.${next}`, fromStatus: trip.status || "", toStatus: next, actorType, actorUserId: actorId, idempotencyKey: args.idempotencyKey, occurredAt: /* @__PURE__ */ new Date(), metadata: { action: args.action, reason, commandBinding } } });
    if (next === "no_show") await tx.payment.updateMany({ where: { tripId: trip.id, purpose: "fare", status: "pending" }, data: { status: "cancelled" } });
    if (next === "no_show" && noShowEconomics) {
      await tx.cancellation.create({ data: { tripId: trip.id, actorType: "driver", reasonCode: "rider_no_show", reason: reason || "Rider did not arrive", policySnapshot: { source: "accepted_quote_snapshot" }, feeMinor: noShowEconomics.feeMinor, currencyCode: noShowEconomics.currencyCode, refundRequired: "manual_review" } });
    }
    if (trip.driverId && ["driver_en_route", "driver_arrived", "in_progress"].includes(next)) await tx.driverProfile.updateMany({ where: { id: trip.driverId, dispatchStatus: { in: ["available", "offered", "assigned", "on_trip"] } }, data: { dispatchStatus: "on_trip" } });
    if (trip.acceptedOfferId && ["completed", "cancelled", "no_show"].includes(next)) await tx.matchOffer.updateMany({ where: { id: trip.acceptedOfferId, status: "accepted", reservationReleasedAt: null }, data: { reservationReleasedAt: /* @__PURE__ */ new Date() } });
    if (trip.driverId && ["completed", "cancelled", "no_show"].includes(next)) await refreshDriverPresentDispatchStatus(tx, trip.driverId);
    return updated;
  }, { isolationLevel: "Serializable" });
}
async function publicRideshareTrip(_root, args, context) {
  return riderTripStatus(_root, args, context);
}

// features/keystone/lib/trip-receipt.ts
init_request_confirmation();
init_email_layout();
var escapeHtml2 = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function money2(minor, currency) {
  return formatMoney(minor, currency);
}
function receiptLines(fare) {
  const currency = typeof fare?.currencyCode === "string" ? fare.currencyCode : "USD";
  const n = (value) => typeof value === "number" && Number.isFinite(value) ? value : 0;
  const lines = [
    { label: "Base fare", minor: n(fare?.baseFareMinor) },
    { label: "Distance", minor: n(fare?.distanceMinor) },
    { label: "Time", minor: n(fare?.durationMinor) },
    { label: "Booking fee", minor: n(fare?.bookingFeeMinor) }
  ].filter((line) => line.minor > 0);
  const total = n(fare?.totalMinor);
  const listed = lines.reduce((sum, line) => sum + line.minor, 0);
  if (total > listed) lines.push({ label: "Minimum fare adjustment", minor: total - listed });
  return { currency, total, lines: lines.map((line) => ({ label: line.label, amount: money2(line.minor, currency) })) };
}
function tripReceiptHtml(mail) {
  return emailLayout({
    storeName: mail.fleetName,
    preheader: `Trip ${mail.confirmationCode}: ${mail.total}`,
    title: `Thanks for riding, ${mail.name}`,
    body: `${emailParagraph(`Trip <strong>${escapeHtml2(mail.confirmationCode)}</strong><br>${escapeHtml2(mail.whenLabel)}${mail.driverName ? `<br>Driver: ${escapeHtml2(mail.driverName)}` : ""}`)}
${emailPanel(`From: ${escapeHtml2(mail.pickup)}<br>To: ${escapeHtml2(mail.dropoff)}`)}
${emailTotals([...mail.lines.map((line) => ({ label: line.label, value: line.amount })), { label: "Total", value: mail.total }])}
${emailMuted(escapeHtml2(mail.paymentLine))}
${emailButton("View your rides", mail.link)}`
  });
}
async function sendTripReceiptEmail(mail) {
  try {
    const port = Number(process.env.SMTP_PORT);
    const { createTransport: createTransport3 } = await import("nodemailer");
    const info = await createTransport3({ host: process.env.SMTP_HOST, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }).sendMail({
      to: mail.to,
      from: process.env.SMTP_FROM,
      subject: `Your ${mail.fleetName} receipt \xB7 ${mail.confirmationCode}`,
      html: tripReceiptHtml(mail)
    });
    return { sent: true, messageId: typeof info?.messageId === "string" ? info.messageId : void 0 };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
function paymentLine(payments, total) {
  const fare = payments.find((payment) => (payment.purpose || "fare") === "fare" && ["captured", "succeeded", "paid", "confirmed"].includes(String(payment.status)));
  if (fare) {
    const card = fare.providerEvidence?.card;
    return card?.last4 ? `Charged ${total} to your ${String(card.brand || "card").replace(/^\w/, (c) => c.toUpperCase())} ending ${card.last4}.` : `Paid ${total}.`;
  }
  if (payments.some((payment) => (payment.purpose || "fare") === "fare" && payment.status === "failed")) return `Your card was declined for ${total}. The fleet will contact you to settle the fare.`;
  return `${total} is due to the fleet. Pay as agreed with your driver or from your trip page.`;
}
async function deliverTripReceipt(prisma, tripId, send) {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        status: true,
        requestId: true,
        riderId: true,
        confirmationCode: true,
        startedAt: true,
        completedAt: true,
        pickupLabel: true,
        dropoffLabel: true,
        finalFareSnapshot: true,
        bookingSnapshot: true,
        fleet: { select: { name: true, timezone: true } },
        rider: { select: { email: true, name: true } },
        driver: { select: { publicName: true } },
        payments: { orderBy: [{ createdAt: "desc" }], take: 20, select: { status: true, purpose: true, amountMinor: true, currencyCode: true, providerEvidence: true } }
      }
    });
    if (!trip || trip.status !== "completed") return;
    let row;
    try {
      row = await prisma.notification.create({ data: { tripId: trip.id, recipientId: trip.riderId || null, channel: "email", templateKey: "trip_receipt", status: "sending", payload: { tripId: trip.id, confirmationCode: trip.confirmationCode }, idempotencyKey: `trip-receipt:${trip.id}` }, select: { id: true } });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      return;
    }
    const mark = (status, error, messageId) => prisma.notification.update({ where: { id: row.id }, data: { status, ...messageId ? { providerReference: messageId.slice(0, 200) } : {}, ...status === "sent" ? { sentAt: /* @__PURE__ */ new Date() } : {}, ...error ? { lastError: error.slice(0, 200) } : {} } });
    try {
      const guest = !trip.rider?.email && trip.requestId ? await prisma.notification.findUnique({ where: { idempotencyKey: `ride-request-received:${trip.requestId}` }, select: { payload: true } }) : null;
      const email = trip.rider?.email || (typeof guest?.payload?.receiptEmail === "string" ? guest.payload.receiptEmail : null);
      if (!email) {
        await mark("skipped_no_recipient");
        return;
      }
      if (!requestConfirmationConfigured()) {
        await mark("skipped_not_configured");
        return;
      }
      const fare = trip.finalFareSnapshot || trip.bookingSnapshot?.quote || {};
      const { currency, total, lines } = receiptLines(fare);
      const zone = trip.fleet?.timezone || "UTC";
      const at = trip.completedAt || /* @__PURE__ */ new Date();
      const whenLabel = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(at);
      const totalLabel = money2(total, currency);
      const base = String(process.env.SMTP_STORE_LINK).replace(/\/$/, "");
      const result = await (send || sendTripReceiptEmail)({
        to: email,
        fleetName: trip.fleet?.name || "Your ride service",
        confirmationCode: trip.confirmationCode,
        name: trip.rider?.name || "there",
        whenLabel,
        pickup: trip.pickupLabel || "",
        dropoff: trip.dropoffLabel || "",
        driverName: trip.driver?.publicName || null,
        lines,
        total: totalLabel,
        paymentLine: paymentLine(trip.payments || [], totalLabel),
        link: trip.riderId ? `${base}/account/rides` : `${base}/`
      });
      await (result.sent ? mark("sent", void 0, result.messageId) : mark("failed", result.error || "send_failed"));
    } catch (error) {
      try {
        await mark("failed", error instanceof Error ? error.message : "send_failed");
      } catch {
      }
    }
  } catch (error) {
    console.error("Trip receipt bookkeeping failed:", error instanceof Error ? error.message : "unknown");
  }
}
function receiptAfterTransition(resolver) {
  return async (root, args, context) => {
    const result = await resolver(root, args, context);
    if (result?.id && result.status === "completed") {
      await Promise.race([deliverTripReceipt(context.prisma, result.id), new Promise((resolve) => setTimeout(resolve, 8e3))]).catch(() => {
      });
    }
    return result;
  };
}

// features/keystone/mutations/driverEarnings.ts
init_access();

// features/keystone/mutations/finance.ts
var import_graphql7 = require("graphql");
init_access();

// features/integrations/payment/index.ts
var paymentProviderAdapters = {
  manual: () => Promise.resolve().then(() => (init_manual(), manual_exports)),
  stripe: () => Promise.resolve().then(() => (init_stripe(), stripe_exports))
};

// features/keystone/utils/paymentProviderAdapter.ts
async function executePaymentAdapter({ provider, functionName, args }) {
  const adapterName = provider[functionName];
  const loader = paymentProviderAdapters[adapterName];
  if (!loader) throw new Error("Payment adapter is not admitted by this deployment.");
  const adapter = await loader();
  const fn = adapter[functionName];
  if (typeof fn !== "function") throw new Error(`Payment adapter does not implement ${functionName}.`);
  return fn({ provider, ...args });
}

// features/keystone/mutations/finance.ts
var import_node_util4 = require("node:util");
var import_node_crypto7 = require("node:crypto");

// features/keystone/mutations/onboarding.ts
init_access();

// features/keystone/domain/demoSeedCompleteness.ts
var demoSeedInspectionSelections = {
  fleet: `id slug status providers(where: { kind: { in: ["mapping", "notification", "identity", "background_check"] } }, orderBy: [{ id: asc }], take: 10) { kind adapter status } marketplaceRegistration { sourceId platform status manifestVersion }`,
  membership: "id role status fleet { id } user { id }",
  serviceArea: "id status fleet { id }",
  service: `id slug status passengerCapacity wheelchairAccessible fleet { id }
    serviceAreas(where: { status: { equals: "active" } }, orderBy: [{ id: asc }], take: 25) { id status fleet { id } }
    fareRules(where: { status: { equals: "active" } }, orderBy: [{ id: asc }], take: 25) {
      id status fleet { id } service { id fleet { id } } serviceArea { id status fleet { id } }
    }`,
  policy: `id name kind status fleet { id } evaluations(orderBy: [{ id: asc }], take: 50) {
    id policy { id status fleet { id } } driver { id status fleet { id } } vehicle { id status fleet { id } }
  }`,
  driver: `id status user { id } fleet { id }
    availabilityRules(where: { status: { equals: "active" } }, orderBy: [{ dayOfWeek: asc }, { id: asc }], take: 10) { id dayOfWeek status }`,
  vehicle: `id status capacity wheelchairAccessible fleet { id }
    drivers(where: { status: { equals: "active" } }, orderBy: [{ id: asc }], take: 25) { id status fleet { id } }`,
  document: "kind driver { id fleet { id } } vehicle { id fleet { id } }",
  paymentProvider: "id code isInstalled createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction handleWebhookFunction"
};
async function readRows(read) {
  try {
    const rows = await read();
    return Array.isArray(rows) ? { rows, readable: true } : { rows: [], readable: false };
  } catch {
    return { rows: [], readable: false };
  }
}
var rowInFleet = (row, fleetId) => Boolean(row && row.fleet?.id === fleetId);
var activeInFleet = (row, fleetId) => row?.status === "active" && rowInFleet(row, fleetId);
async function inspectExistingDemoFleet(sudo, context, fleet, userId, mode) {
  const limitations = [
    "These checks verify demo fixture structure only; policy-evaluation records are not evidence of approval, licensing, insurance, background clearance, or driver admission.",
    "Provider rows are configuration fixtures only; no provider connectivity, installation, payment, notification, or identity action was checked or performed.",
    "Structural completeness is not dispatch eligibility, operational readiness, or permission to carry real passengers.",
    "This existing-fleet diagnostic does not create or repair demo records.",
    "Document checks read only bounded kind and relationship metadata through normal driver List access; no file references, evidence contents, review notes, or approval state are projected.",
    "Required document kinds mirror the current demo seed policy only; an owner must validate any real onboarding evidence policy before operational use."
  ];
  const missing = [];
  const fleetId = typeof fleet.id === "string" ? fleet.id : "";
  if (!fleetId) missing.push("The sample fleet could not be found");
  if (mode !== "minimal" && mode !== "full") {
    missing.push("supported demo seed mode (minimal or full)");
  }
  if (fleet.status !== "active") missing.push("Fleet status set to Active");
  if (!fleetId || mode !== "minimal" && mode !== "full") {
    return makeDiagnostic(mode, missing, limitations);
  }
  const scopedSeed = typeof fleet.slug === "string" && fleet.slug.startsWith("harbor-mobility-");
  const standardSlug = scopedSeed ? `${fleet.slug}-standard` : "independent-standard";
  const accessibleSlug = scopedSeed ? `${fleet.slug}-accessible` : "accessible-ride";
  const expectedServiceSlugs = mode === "minimal" ? [standardSlug] : [standardSlug, accessibleSlug];
  const [memberships, areas, services, policies, drivers, vehicles, paymentProviders] = await Promise.all([
    readRows(() => sudo.query.FleetMembership.findMany({
      where: { fleet: { id: { equals: fleetId } }, user: { id: { equals: userId } }, role: { equals: "owner" }, status: { equals: "active" } },
      orderBy: [{ id: "asc" }],
      take: 1,
      query: demoSeedInspectionSelections.membership
    })),
    readRows(() => sudo.query.ServiceArea.findMany({
      where: { fleet: { id: { equals: fleetId } }, status: { equals: "active" } },
      orderBy: [{ id: "asc" }],
      take: 25,
      query: demoSeedInspectionSelections.serviceArea
    })),
    readRows(() => sudo.query.RideService.findMany({
      where: { fleet: { id: { equals: fleetId } }, status: { equals: "active" }, slug: { in: expectedServiceSlugs } },
      orderBy: [{ id: "asc" }],
      take: expectedServiceSlugs.length,
      query: demoSeedInspectionSelections.service
    })),
    readRows(() => sudo.query.Policy.findMany({
      where: { fleet: { id: { equals: fleetId } }, kind: { in: ["driver_eligibility", "vehicle_eligibility"] }, status: { equals: "active" } },
      orderBy: [{ id: "asc" }],
      take: 2,
      query: demoSeedInspectionSelections.policy
    })),
    readRows(() => sudo.query.DriverProfile.findMany({
      where: { fleet: { id: { equals: fleetId } }, user: { id: { equals: userId } }, status: { equals: "active" } },
      orderBy: [{ id: "asc" }],
      take: 1,
      query: demoSeedInspectionSelections.driver
    })),
    readRows(() => sudo.query.Vehicle.findMany({
      where: { fleet: { id: { equals: fleetId } }, status: { equals: "active" } },
      orderBy: [{ id: "asc" }],
      take: 25,
      query: demoSeedInspectionSelections.vehicle
    })),
    readRows(() => context.query.PaymentProvider.findMany({
      where: { code: { equals: "pp_manual" } },
      orderBy: [{ id: "asc" }],
      take: 1,
      query: demoSeedInspectionSelections.paymentProvider
    }))
  ]);
  const readNames = [
    ["owner membership", memberships],
    ["active service areas", areas],
    ["active services and linked fare/area rows", services],
    ["active demo policy and evaluation fixtures", policies],
    ["active owner-linked demo driver and availability", drivers],
    ["active vehicles and driver links", vehicles],
    ["manual payment-provider fixture under existing finance List access", paymentProviders]
  ];
  for (const [name, result] of readNames) {
    if (!result.readable) missing.push(`${name} could not be verified`);
  }
  const ownerMembership = memberships.rows.some((row) => rowInFleet(row, fleetId) && row.user?.id === userId && row.role === "owner" && row.status === "active");
  if (memberships.readable && !ownerMembership) missing.push("You as an owner of the fleet");
  const activeAreas = areas.rows.filter((row) => activeInFleet(row, fleetId) && typeof row.id === "string");
  if (areas.readable && activeAreas.length === 0) missing.push("An active service area");
  const activeAreaIds = new Set(activeAreas.map((row) => row.id));
  const activeServices = services.rows.filter((row) => activeInFleet(row, fleetId) && expectedServiceSlugs.includes(row.slug));
  for (const slug of expectedServiceSlugs) {
    const service = activeServices.find((row) => row.slug === slug);
    if (!services.readable || !service) {
      if (services.readable) missing.push(`Active service ${serviceLabel(slug)}`);
      continue;
    }
    const linkedAreaIds = new Set((Array.isArray(service.serviceAreas) ? service.serviceAreas : []).filter((area) => activeInFleet(area, fleetId) && activeAreaIds.has(area.id)).map((area) => area.id));
    if (linkedAreaIds.size === 0) missing.push(`Service area for ${serviceLabel(slug)}`);
    const hasMatchingFare = (Array.isArray(service.fareRules) ? service.fareRules : []).some((fare) => fare.status === "active" && rowInFleet(fare, fleetId) && fare.service?.id === service.id && rowInFleet(fare.service, fleetId) && linkedAreaIds.has(fare.serviceArea?.id) && activeInFleet(fare.serviceArea, fleetId));
    if (linkedAreaIds.size > 0 && !hasMatchingFare) {
      missing.push(`Active fare rule for ${serviceLabel(slug)}`);
    }
  }
  const demoPolicy = policies.rows.find((row) => activeInFleet(row, fleetId) && row.name === "Demo driver and vehicle evidence policy" && row.kind === "driver_eligibility");
  if (policies.readable && !demoPolicy) missing.push("Active driver eligibility policy");
  const demoDriver = drivers.rows.find((row) => activeInFleet(row, fleetId) && row.user?.id === userId);
  if (drivers.readable && !demoDriver) missing.push("Active sample driver linked to your account");
  const weekdayRules = Array.isArray(demoDriver?.availabilityRules) ? demoDriver.availabilityRules : [];
  const missingDays = [1, 2, 3, 4, 5].filter((day) => !weekdayRules.some((rule) => rule.status === "active" && rule.dayOfWeek === day));
  if (demoDriver && missingDays.length) missing.push(`Sample driver hours (missing days ${missingDays.join(", ")})`);
  const activeVehicles = vehicles.rows.filter((row) => activeInFleet(row, fleetId) && typeof row.id === "string");
  if (vehicles.readable && activeVehicles.length === 0) missing.push("An active vehicle");
  const pairedVehicles = activeVehicles.filter((vehicle) => Array.isArray(vehicle.drivers) && vehicle.drivers.some((driver) => activeInFleet(driver, fleetId) && driver.id === demoDriver?.id));
  if (demoDriver && vehicles.readable && pairedVehicles.length === 0) missing.push("A vehicle assigned to the sample driver");
  if (demoDriver) {
    const documentBranches = [
      { driver: { id: { equals: demoDriver.id } } },
      ...pairedVehicles.map((vehicle) => ({ vehicle: { id: { equals: vehicle.id } } }))
    ];
    const documents = await readRows(() => context.query.ComplianceDocument.findMany({
      where: { OR: documentBranches },
      orderBy: [{ id: "asc" }],
      take: 25,
      query: demoSeedInspectionSelections.document
    }));
    if (!documents.readable) {
      missing.push("Driver and vehicle documents could not be checked with your access");
    } else {
      const driverDocuments = documents.rows.filter((row) => row.kind && row.driver?.id === demoDriver.id && rowInFleet(row.driver, fleetId));
      for (const kind of ["driver_license", "insurance"]) {
        if (!driverDocuments.some((row) => row.kind === kind)) {
          missing.push(`Sample driver: ${kind.replaceAll("_", " ")} document`);
        }
      }
      for (const vehicle of pairedVehicles) {
        const vehicleDocuments = documents.rows.filter((row) => row.kind && row.vehicle?.id === vehicle.id && rowInFleet(row.vehicle, fleetId));
        for (const kind of ["vehicle_registration", "inspection"]) {
          if (!vehicleDocuments.some((row) => row.kind === kind)) {
            missing.push(`Sample vehicle: ${kind.replaceAll("_", " ")} document`);
          }
        }
      }
    }
  }
  const policyEvaluations = demoPolicy && Array.isArray(demoPolicy.evaluations) ? demoPolicy.evaluations : [];
  if (demoPolicy && demoDriver && !policyEvaluations.some((evaluation) => evaluation.policy?.id === demoPolicy.id && rowInFleet(evaluation.policy, fleetId) && evaluation.driver?.id === demoDriver.id && activeInFleet(evaluation.driver, fleetId))) {
    missing.push("Eligibility check for the sample driver");
  }
  const vehiclePolicy = policies.rows.find((row) => activeInFleet(row, fleetId) && row.kind === "vehicle_eligibility");
  const vehicleEvaluations = Array.isArray(vehiclePolicy?.evaluations) ? vehiclePolicy.evaluations : [];
  if (pairedVehicles.length && !pairedVehicles.some((vehicle) => vehicleEvaluations.some((evaluation) => evaluation.policy?.id === vehiclePolicy?.id && rowInFleet(evaluation.policy, fleetId) && evaluation.vehicle?.id === vehicle.id && activeInFleet(evaluation.vehicle, fleetId)))) {
    missing.push("Eligibility check for the sample vehicle");
  }
  if (mode === "full") {
    const accessibleService = activeServices.find((row) => row.slug === accessibleSlug && row.wheelchairAccessible === true);
    const accessibleVehicle = accessibleService && pairedVehicles.some((vehicle) => vehicle.wheelchairAccessible === true && typeof vehicle.capacity === "number" && typeof accessibleService.passengerCapacity === "number" && vehicle.capacity >= accessibleService.passengerCapacity);
    if (accessibleService && !accessibleVehicle) missing.push("A wheelchair-accessible vehicle for the accessible service");
  }
  if (fleet && !hasExpectedProviderFixtures(fleet.providers)) {
    missing.push("Provider connections (mapping, identity, background check)");
  }
  const registration = fleet.marketplaceRegistration;
  if (!registration || !["source-openfront-rideshare-local", `source-rideshare-${fleetId}`].includes(registration.sourceId) || registration.platform !== "openfront-rideshare" || registration.status !== "active" || registration.manifestVersion !== "1") {
    missing.push("Marketplace registration");
  }
  const manualProvider = paymentProviders.rows.find((row) => row.code === "pp_manual");
  if (paymentProviders.readable && !hasManualPaymentFixture(manualProvider)) {
    missing.push("Manual payment provider");
  }
  return makeDiagnostic(mode, [...new Set(missing)], limitations);
}
function hasExpectedProviderFixtures(value) {
  if (!Array.isArray(value)) return false;
  const expected = [
    ["mapping", "osm", "active"],
    ["identity", "manual", "unconfigured"],
    ["background_check", "manual", "unconfigured"]
  ];
  return expected.every(([kind, adapter, status]) => value.some((row) => row.kind === kind && row.adapter === adapter && row.status === status));
}
var serviceLabel = (slug) => slug.endsWith("-accessible") ? "Accessible Ride" : slug.endsWith("-standard") ? "Independent Standard" : slug;
function hasManualPaymentFixture(row) {
  return row?.code === "pp_manual" && row.isInstalled === "yes" && row.createPaymentFunction === "manual" && row.capturePaymentFunction === "manual" && row.refundPaymentFunction === "manual" && row.getPaymentStatusFunction === "manual" && row.handleWebhookFunction === "manual";
}
function makeDiagnostic(mode, missing, limitations) {
  const setupComplete = missing.length === 0;
  return {
    mode,
    setupComplete,
    onboardingStatus: setupComplete ? "completed" : "in_progress",
    missing,
    limitations,
    message: setupComplete ? "Existing demo fixture structure passed bounded source checks; no operational readiness is implied." : "Existing demo fixture completeness is missing or unverified. Onboarding remains in progress; this check did not repair or create records."
  };
}

// features/keystone/mutations/onboarding.ts
function requestBaseUrl(req) {
  const header = (name) => String(req?.headers?.[name] || "").split(",")[0].trim();
  const host = header("x-forwarded-host") || header("host");
  return host ? `${header("x-forwarded-proto") || "https"}://${host}` : "";
}
async function dismissRideshareOnboarding(_root, _args, context) {
  return context.prisma.$transaction(async (tx) => {
    const actorId = await currentRiderId(tx, context.session);
    if (!actorId) return false;
    const user = await tx.user.findUnique({ where: { id: actorId }, select: { onboardingStatus: true } });
    if (!user || user.onboardingStatus === "completed") return false;
    if (user.onboardingStatus === "dismissed") return true;
    const result = await tx.user.updateMany({ where: { id: actorId, onboardingStatus: user.onboardingStatus }, data: { onboardingStatus: "dismissed" } });
    return result.count === 1;
  }, { isolationLevel: "Serializable" });
}
async function bootstrapRideshare(_root, args, context) {
  if (!context.session?.itemId || !await permissions.canManageOnboarding({ context, session: context.session })) throw new Error("Onboarding permission is required.");
  if (args.mode !== "minimal" && args.mode !== "full") throw new Error("Setup mode must be minimal or full.");
  const userId = context.session.itemId;
  const demoSlug = `harbor-mobility-${userId}`;
  const demoFleetWhere = { OR: [{ slug: { equals: demoSlug } }, { slug: { equals: "harbor-independent-mobility" }, memberships: { some: { user: { id: { equals: userId } }, role: { equals: "owner" }, status: { equals: "active" } } } }] };
  const sudo = context.sudo();
  const existing = await sudo.query.Fleet.findMany({ where: demoFleetWhere, take: 1, query: "id" });
  if (existing[0]) {
    if (!await canAccessFleet(context, context.session, existing[0].id, "fleetAdmin")) throw new Error("Fleet setup is unavailable.");
    existing[0] = await sudo.query.Fleet.findOne({ where: { id: existing[0].id }, query: demoSeedInspectionSelections.fleet });
    const diagnostic = await inspectExistingDemoFleet(sudo, context, existing[0], userId, args.mode);
    await sudo.query.User.updateOne({ where: { id: userId }, data: { onboardingStatus: diagnostic.onboardingStatus } });
    return { fleetId: existing[0].id, created: false, summary: diagnostic };
  }
  await sudo.query.User.updateOne({ where: { id: userId }, data: { onboardingStatus: "in_progress" } });
  return context.transaction(async (transactionContext) => {
    if (!await permissions.canManageOnboarding({ context: transactionContext, session: context.session })) throw new Error("Onboarding permission is required.");
    await transactionContext.prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`setup:${userId}`}, 0))::text IS NOT NULL`;
    const transactionSudo = transactionContext.sudo();
    const racedFleet = await transactionSudo.query.Fleet.findMany({ where: demoFleetWhere, take: 1, query: "id" });
    if (racedFleet[0]) {
      if (!await canAccessFleet(transactionContext, context.session, racedFleet[0].id, "fleetAdmin")) throw new Error("Fleet setup is unavailable.");
      racedFleet[0] = await transactionSudo.query.Fleet.findOne({ where: { id: racedFleet[0].id }, query: demoSeedInspectionSelections.fleet });
      const diagnostic2 = await inspectExistingDemoFleet(transactionSudo, transactionContext, racedFleet[0], userId, args.mode);
      await transactionSudo.query.User.updateOne({ where: { id: userId }, data: { onboardingStatus: diagnostic2.onboardingStatus } });
      return { fleetId: racedFleet[0].id, created: false, summary: diagnostic2 };
    }
    const full = args.mode === "full";
    const fleet = await transactionSudo.query.Fleet.createOne({ data: { name: "Harbor Independent Mobility", logoIcon: DEFAULT_STORE_LOGO_ICON, logoColor: DEFAULT_STORE_LOGO_COLOR, slug: demoSlug, status: "active", operationsMode: "manual", publicDescription: "A driver-owned cooperative serving central neighborhoods with transparent source-owned pricing.", publicCity: "Harbor City", countryCode: "US", currencyCode: "USD", timezone: "America/New_York", supportEmail: "hello@rideshare.openship.org", preciseLocationRetentionDays: "30" }, query: "id" });
    await transactionSudo.query.FleetMembership.createOne({ data: { fleet: { connect: { id: fleet.id } }, user: { connect: { id: userId } }, role: "owner", status: "active", acceptedAt: /* @__PURE__ */ new Date() } });
    const area = await transactionSudo.query.ServiceArea.createOne({ data: { fleet: { connect: { id: fleet.id } }, name: "Harbor City Core", publicRegionLabel: "Harbor City central neighborhoods", countryCode: "US", status: "active", coarseBounds: { disclosure: "Coarse public service region; exact driver locations are not published." } }, query: "id" });
    const service = await transactionSudo.query.RideService.createOne({ data: { fleet: { connect: { id: fleet.id } }, serviceAreas: { connect: [{ id: area.id }] }, name: "Independent Standard", slug: `${demoSlug}-standard`, description: "Everyday rides from locally operated independent drivers.", status: "active", category: "standard", passengerCapacity: 4, advanceBookingMinutes: 0 }, query: "id" });
    const accessible = full ? await transactionSudo.query.RideService.createOne({ data: { fleet: { connect: { id: fleet.id } }, serviceAreas: { connect: [{ id: area.id }] }, name: "Accessible Ride", slug: `${demoSlug}-accessible`, description: "Wheelchair-accessible service when an eligible vehicle is available.", status: "active", category: "accessible", passengerCapacity: 4, wheelchairAccessible: true, advanceBookingMinutes: 0 }, query: "id" }) : null;
    for (const target of [service, accessible].filter(Boolean)) {
      await transactionSudo.query.FareRule.createOne({ data: { fleet: { connect: { id: fleet.id } }, service: { connect: { id: target.id } }, serviceArea: { connect: { id: area.id } }, name: `${target.id === service.id ? "Standard" : "Accessible"} transparent fare`, version: 1, status: "active", currencyCode: "USD", baseFareMinor: 350, perDistanceUnitMinor: 185, distanceUnit: "mile", perMinuteMinor: 35, bookingFeeMinor: 100, minimumFareMinor: 850, cancellationFeeMinor: 500, noShowFeeMinor: 900, maximumMultiplierBasisPoints: 1e4, rules: { dynamicPricingEnabled: false } } });
    }
    const policy = await transactionSudo.query.Policy.createOne({ data: { fleet: { connect: { id: fleet.id } }, name: "Demo driver and vehicle evidence policy", version: "2026-demo-1", jurisdiction: "Example only \u2014 deployer must replace", kind: "driver_eligibility", status: "active", requirements: { requiredEvidence: ["driver_license", "insurance", "vehicle_registration", "inspection"], manualReviewRequired: true }, evidenceSources: [{ source: "operator review", authoritative: false }], disclaimer: "Demo evidence policy only. This does not establish legal eligibility, approval, insurance coverage, or background-check clearance." }, query: "id" });
    const vehiclePolicy = await transactionSudo.query.Policy.createOne({ data: { fleet: { connect: { id: fleet.id } }, name: "Demonstration vehicle evidence policy", version: "2026-demo-1", kind: "vehicle_eligibility", status: "active", requirements: { demonstrationOnly: true }, evidenceSources: [{ authoritative: false }], disclaimer: "Demonstration metadata; no inspection, insurance or legal approval." }, query: "id" });
    const driver = await transactionSudo.query.DriverProfile.createOne({ data: { fleet: { connect: { id: fleet.id } }, user: { connect: { id: userId } }, publicName: "Maya R.", publicBio: "Independent local driver and cooperative member.", status: "active", dispatchStatus: "available", acceptsScheduled: true, languages: ["English", "Spanish"] }, query: "id" });
    const vehicle = await transactionSudo.query.Vehicle.createOne({ data: { fleet: { connect: { id: fleet.id } }, drivers: { connect: [{ id: driver.id }] }, label: "Blue 2022 Hybrid", make: "Example", model: "Hybrid Sedan", year: 2022, color: "Blue", plateMasked: "\u2022\u2022\u2022 482", capacity: 4, wheelchairAccessible: full, status: "active" }, query: "id" });
    const documentExpiry = new Date(Date.now() + 365 * 24 * 60 * 6e4);
    for (const document of [
      { owner: { driver: { connect: { id: driver.id } } }, kind: "driver_license", issuer: "Sample licensing office" },
      { owner: { driver: { connect: { id: driver.id } } }, kind: "insurance", issuer: "Sample insurer" },
      { owner: { vehicle: { connect: { id: vehicle.id } } }, kind: "vehicle_registration", issuer: "Sample registry" },
      { owner: { vehicle: { connect: { id: vehicle.id } } }, kind: "inspection", issuer: "Sample inspection station" }
    ]) {
      await transactionSudo.query.ComplianceDocument.createOne({ data: { ...document.owner, kind: document.kind, status: "accepted_evidence", issuer: document.issuer, referenceMasked: "SAMPLE", issuedAt: /* @__PURE__ */ new Date(), expiresAt: documentExpiry, reviewedAt: /* @__PURE__ */ new Date(), reviewer: { connect: { id: userId } }, reviewNotes: "Sample document from starter setup." } });
    }
    const evalExpiry = new Date(Date.now() + 90 * 24 * 60 * 6e4);
    await transactionSudo.query.PolicyEvaluation.createOne({ data: { policy: { connect: { id: policy.id } }, driver: { connect: { id: driver.id } }, outcome: "eligible", reasons: ["Demo operator review recorded; not a legal determination."], evidenceSnapshot: { policyVersion: "2026-demo-1", authoritative: false, kind: "demonstration" }, evaluatedAt: /* @__PURE__ */ new Date(), expiresAt: evalExpiry, evaluator: { connect: { id: userId } } } });
    await transactionSudo.query.PolicyEvaluation.createOne({ data: { policy: { connect: { id: vehiclePolicy.id } }, vehicle: { connect: { id: vehicle.id } }, outcome: "eligible", reasons: ["Demo vehicle evidence review recorded; not an inspection certification."], evidenceSnapshot: { policyVersion: "2026-demo-1", authoritative: false, kind: "demonstration" }, evaluatedAt: /* @__PURE__ */ new Date(), expiresAt: evalExpiry, evaluator: { connect: { id: userId } } } });
    for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) {
      await transactionSudo.query.AvailabilityRule.createOne({ data: { driver: { connect: { id: driver.id } }, dayOfWeek, startTime: "00:00", endTime: "23:59", timezone: "America/New_York", status: "active" } });
    }
    await transactionContext.prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"provider:pp_manual"}, 0))::text IS NOT NULL`;
    const manualProvider = await transactionSudo.query.PaymentProvider.findOne({ where: { code: "pp_manual" }, query: "id" });
    if (!manualProvider) await transactionSudo.query.PaymentProvider.createOne({ data: { name: "Manual payments", code: "pp_manual", isInstalled: "yes", createPaymentFunction: "manual", capturePaymentFunction: "manual", refundPaymentFunction: "manual", getPaymentStatusFunction: "manual", handleWebhookFunction: "manual", metadata: { disclosure: "Records payment evidence only; does not move money." } } });
    for (const [name, kind, adapter] of [["Open map routing", "mapping", "osm"], ["Unconfigured identity evidence", "identity", "manual"], ["Unconfigured background-check evidence", "background_check", "manual"]]) {
      await transactionSudo.query.ProviderConnection.createOne({ data: { fleet: { connect: { id: fleet.id } }, name, kind, adapter, status: kind === "mapping" ? "active" : "unconfigured", capabilities: [], evidencePolicyUrl: "" } });
    }
    await transactionSudo.query.MarketplaceRegistration.createOne({ data: { fleet: { connect: { id: fleet.id } }, sourceId: `source-rideshare-${fleet.id}`, platform: "openfront-rideshare", status: "active", manifestVersion: "1", publicBaseUrl: requestBaseUrl(context.req), capabilities: ["marketplace.discovery", "rideshare.quote", "rideshare.request", "rideshare.trip.view"], verificationEvidence: { localContractTestsRequired: true } } });
    const persistedFleet = await transactionSudo.query.Fleet.findOne({ where: { id: fleet.id }, query: demoSeedInspectionSelections.fleet });
    const diagnostic = await inspectExistingDemoFleet(transactionSudo, transactionContext, persistedFleet, userId, args.mode);
    await transactionSudo.query.User.updateOne({ where: { id: userId }, data: { onboardingStatus: diagnostic.onboardingStatus } });
    return { fleetId: fleet.id, created: true, summary: diagnostic };
  }, { maxWait: 1e4, timeout: 6e4 });
}

// features/keystone/domain/lifecycles.ts
var import_graphql6 = require("graphql");
var lifecycles = {
  payment: {
    pending: ["authorized", "captured", "failed", "cancelled"],
    authorized: ["captured", "failed", "cancelled"],
    captured: ["partially_refunded", "refunded"],
    partially_refunded: ["partially_refunded", "refunded"],
    failed: ["pending"],
    refunded: [],
    cancelled: []
  },
  refund: {
    requested: ["processing", "succeeded", "failed", "cancelled"],
    processing: ["succeeded", "failed", "cancelled"],
    succeeded: [],
    failed: [],
    cancelled: []
  },
  document: {
    submitted: ["under_review", "accepted_evidence", "rejected_evidence"],
    under_review: ["accepted_evidence", "rejected_evidence"],
    accepted_evidence: ["revoked", "expired"],
    rejected_evidence: [],
    expired: [],
    revoked: []
  },
  vehicle: {
    pending_review: ["active", "maintenance", "suspended", "retired"],
    active: ["maintenance", "suspended", "retired"],
    maintenance: ["active", "suspended", "retired"],
    suspended: ["active", "maintenance", "retired"],
    retired: []
  },
  driver: {
    applicant: ["pending_review", "active", "paused", "ineligible", "offboarded"],
    pending_review: ["active", "paused", "ineligible", "offboarded"],
    active: ["paused", "ineligible", "offboarded"],
    paused: ["active", "ineligible", "offboarded"],
    ineligible: ["active", "paused", "offboarded"],
    offboarded: ["active"]
  },
  incident: {
    open: ["triage", "investigating", "resolved"],
    triage: ["investigating", "resolved"],
    investigating: ["resolved"],
    resolved: ["closed", "investigating"],
    closed: []
  },
  supportCase: {
    open: ["waiting", "resolved"],
    waiting: ["open", "resolved"],
    resolved: ["closed", "open"],
    closed: []
  },
  review: {
    pending: ["published", "hidden", "removed"],
    published: ["hidden", "removed"],
    hidden: ["published", "removed"],
    removed: []
  }
};
function canTransition(machine, from, to) {
  const map = lifecycles[machine];
  return (map[from || Object.keys(map)[0]] || []).includes(to);
}
function assertTransition(machine, from, to, noun) {
  if (canTransition(machine, from, to)) return;
  const current = String(from || Object.keys(lifecycles[machine])[0]).replaceAll("_", " ");
  throw new import_graphql6.GraphQLError(`A ${current} ${noun} can\u2019t move to ${to.replaceAll("_", " ")}.`, { extensions: { code: "RIDESHARE_ILLEGAL_TRANSITION" } });
}
var COMMITTED_TRIP_STATUSES = ["driver_assigned", "driver_en_route", "driver_arrived", "in_progress"];
var COLLECTABLE_FARE_TRIP_STATUSES = [...COMMITTED_TRIP_STATUSES, "completed"];

// features/keystone/mutations/finance.ts
function requireIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (key.length < 12 || key.length > 200) throw new import_graphql7.GraphQLError("A stable idempotency key of 12\u2013200 characters is required.");
  return key;
}
async function appendObservation(prisma, paymentId, observation) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${paymentId}`}, 0))::text IS NOT NULL`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new import_graphql7.GraphQLError("Original payment evidence is unavailable.");
    return tx.paymentObservation.create({ data: { paymentId, refundId: observation.refundId || null, observationKey: (0, import_node_crypto7.randomUUID)(), details: observation } });
  }, { isolationLevel: "Serializable" });
}
function moneySnapshot(value) {
  const quote = value?.quote && typeof value.quote === "object" ? value.quote : {};
  const fare = quote.fare && typeof quote.fare === "object" ? quote.fare : {};
  const amount = quote.totalMinor ?? fare.totalMinor;
  const currency = quote.currencyCode ?? fare.currencyCode;
  if (typeof currency !== "string") throw new import_graphql7.GraphQLError("Trip currency evidence is unavailable.");
  currencyDigits(currency);
  if (!validMinor(amount) || amount <= 0) throw new import_graphql7.GraphQLError("Trip does not have a payable fare snapshot.");
  return { amount, currency };
}
async function initiateTripPayment(_root, args, context) {
  if (!humanSessionId(context.session)) throw new import_graphql7.GraphQLError("Authentication is required.");
  const idempotencyKey = requireIdempotencyKey(args.idempotencyKey);
  const prisma = context.prisma;
  const preflight = await prisma.$transaction(async (tx) => {
    const authority = await authorizedTripHeader(tx, context.session, args.tripId, "riderOrOperator", "finance");
    if (!authority?.bound) throw new import_graphql7.GraphQLError("Trip not found.");
    const trip2 = await tx.trip.findFirst({ where: tripAuthorityWhere(authority.header), select: { id: true, status: true, confirmationCode: true, rider: { select: { id: true, email: true } }, fleet: { select: { id: true } }, bookingSnapshot: true } });
    if (!trip2) throw new import_graphql7.GraphQLError("Trip not found.");
    return { trip: trip2, header: authority.header };
  }, { isolationLevel: "RepeatableRead" });
  const trip = preflight.trip;
  await requireFleetOperations(prisma, trip.fleet?.id);
  const sudo = context.sudo();
  if (!COLLECTABLE_FARE_TRIP_STATUSES.includes(trip.status || "")) throw new import_graphql7.GraphQLError("Trip is not in a payable state.");
  const { amount, currency } = moneySnapshot(trip.bookingSnapshot);
  const provider = await sudo.query.PaymentProvider.findOne({ where: { code: args.providerCode }, query: "id code isInstalled createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction handleWebhookFunction" });
  if (!provider || provider.isInstalled !== "yes") throw new import_graphql7.GraphQLError("Payment provider is unavailable.");
  const reservation = await prisma.$transaction(async (tx) => {
    const lockKey = `payment-init:${trip.id}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text IS NOT NULL`;
    await fenceHumanAuthority(tx, context.session, preflight.header.fleetId);
    const authority = await authorizedTripHeader(tx, context.session, trip.id, "riderOrOperator", "finance");
    if (!authority?.bound || !sameTripAuthority(authority.header, preflight.header)) throw new import_graphql7.GraphQLError("Trip payment authority or assignment changed; reconciliation is required.");
    const currentTrip = await tx.trip.findFirst({ where: tripAuthorityWhere(authority.header), select: { status: true, bookingSnapshot: true } });
    if (!currentTrip || !COLLECTABLE_FARE_TRIP_STATUSES.includes(currentTrip.status || "")) throw new import_graphql7.GraphQLError("Trip is not in a payable state.");
    const currentMoney = moneySnapshot(currentTrip.bookingSnapshot);
    if (currentMoney.amount !== amount || currentMoney.currency !== currency) throw new import_graphql7.GraphQLError("Accepted payment economics changed; reconciliation is required.");
    const replay = await tx.payment.findUnique({ where: { idempotencyKey } });
    const command = { version: 1, purpose: "payment_initiation", actorId: context.session.itemId, assignment: authority.header, body: { tripId: args.tripId, providerCode: args.providerCode, amountMinor: amount, currencyCode: currency } };
    if (replay) {
      const evidence2 = replay.providerEvidence;
      if (replay.tripId !== trip.id || replay.providerId !== provider.id || replay.amountMinor !== amount || replay.currencyCode !== currency || !(0, import_node_util4.isDeepStrictEqual)(evidence2?.command, command)) throw new import_graphql7.GraphQLError("Idempotency key belongs to a different payment intent or original binding is unavailable.");
      return { payment: replay, shouldExecute: false };
    }
    const active = await tx.payment.findFirst({ where: { tripId: trip.id, purpose: "fare", status: { in: ["pending", "authorized", "captured", "partially_refunded"] } } });
    if (active) throw new import_graphql7.GraphQLError("A payment attempt already exists for this trip. Reconciliation is required before another attempt.");
    const payment = await tx.payment.create({ data: {
      tripId: trip.id,
      providerId: provider.id,
      amountMinor: amount,
      currencyCode: currency,
      status: "pending",
      idempotencyKey,
      providerEvidence: { command, providerSnapshot: { ...provider }, phase: "intent_recorded", adapter: provider.createPaymentFunction, disclosure: "No money movement has been verified." }
    } });
    return { payment, shouldExecute: true };
  }, { isolationLevel: "Serializable" });
  if (!reservation.shouldExecute) return reservation.payment;
  let evidence;
  try {
    evidence = await executePaymentAdapter({ provider, functionName: "createPaymentFunction", args: { trip, amount, currency, idempotencyKey, origin: requestBaseUrl(context.req) } });
  } catch {
    await appendObservation(prisma, reservation.payment.id, { observationId: `${reservation.payment.id}:create`, providerId: provider.id, amountMinor: amount, currencyCode: currency, phase: "outcome_indeterminate", observedAt: (/* @__PURE__ */ new Date()).toISOString() });
    throw new import_graphql7.GraphQLError("Payment outcome is indeterminate. The durable intent was retained for reconciliation; do not submit a new key.");
  }
  await appendObservation(prisma, reservation.payment.id, { observationId: `${reservation.payment.id}:create`, providerId: provider.id, amountMinor: amount, currencyCode: currency, phase: "pending", externalId: String(evidence.externalId || "").slice(0, 200), observedAt: (/* @__PURE__ */ new Date()).toISOString() });
  return prisma.payment.update({ where: { id: reservation.payment.id }, data: {
    status: "pending",
    providerReference: String(evidence.externalId || "")
  } });
}
async function requestTripRefund(_root, args, context) {
  if (!humanSessionId(context.session)) throw new import_graphql7.GraphQLError("Authentication is required.");
  const idempotencyKey = requireIdempotencyKey(args.idempotencyKey);
  const amount = Number(args.amountMinor);
  if (!validMinor(amount) || amount <= 0) throw new import_graphql7.GraphQLError("Refund amount must be a positive integer in minor currency units.");
  const reason = args.reason ?? "";
  if (typeof reason !== "string" || reason.length > 500) throw new import_graphql7.GraphQLError("Refund reason is invalid.");
  const prisma = context.prisma;
  const preflight = await prisma.$transaction(async (tx) => {
    const paymentHeader = await tx.payment.findUnique({ where: { id: args.paymentId }, select: { id: true, tripId: true } });
    const authority = paymentHeader?.tripId ? await authorizedTripHeader(tx, context.session, paymentHeader.tripId, "operator", "finance") : null;
    if (!authority?.bound) throw new import_graphql7.GraphQLError("Payment is not refundable.");
    const payment2 = await tx.payment.findFirst({ where: { id: args.paymentId, tripId: authority.header.id }, select: { id: true, amountMinor: true, currencyCode: true, status: true, providerReference: true, providerEvidence: true, provider: { select: { id: true, code: true, isInstalled: true, refundPaymentFunction: true } } } });
    if (!payment2) throw new import_graphql7.GraphQLError("Payment is not refundable.");
    return { payment: payment2, header: authority.header };
  }, { isolationLevel: "RepeatableRead" });
  await requireFleetOperations(prisma, preflight.header.fleetId);
  const payment = preflight.payment;
  if (!["captured", "partially_refunded"].includes(payment.status || "")) throw new import_graphql7.GraphQLError("Payment is not refundable.");
  const provider = payment.provider;
  if (!provider || provider.isInstalled !== "yes" || payment.amountMinor == null || payment.amountMinor <= 0 || !/^[A-Z]{3}$/.test(payment.currencyCode || "")) throw new import_graphql7.GraphQLError("Payment evidence is incomplete and requires manual review.");
  const reservation = await prisma.$transaction(async (tx) => {
    const lockKey = `payment:${payment.id}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text IS NOT NULL`;
    await fenceHumanAuthority(tx, context.session, preflight.header.fleetId);
    const authority = await authorizedTripHeader(tx, context.session, preflight.header.id, "operator", "finance");
    if (!authority?.bound || !sameTripAuthority(authority.header, preflight.header)) throw new import_graphql7.GraphQLError("Refund authority or assignment changed; reconciliation is required.");
    const paymentHeader = await tx.payment.findUnique({ where: { id: payment.id }, select: { id: true, tripId: true, providerId: true } });
    if (paymentHeader?.tripId !== authority.header.id || paymentHeader.providerId !== payment.provider?.id) throw new import_graphql7.GraphQLError("Refund payment binding changed; reconciliation is required.");
    const replay = await tx.refund.findUnique({ where: { idempotencyKey } });
    const commandBinding = { version: 1, purpose: "payment_refund", actorId: context.session.itemId, assignment: authority.header, bodyHash: commandBodyHash({ paymentId: args.paymentId, amountMinor: amount, reason }) };
    const priorCommand = await tx.tripEvent.findUnique({ where: { idempotencyKey } });
    if (replay) {
      if (replay.paymentId !== payment.id || replay.amountMinor !== amount || !(0, import_node_util4.isDeepStrictEqual)(priorCommand?.metadata?.commandBinding, commandBinding)) throw new import_graphql7.GraphQLError("Idempotency key belongs to a different refund command or original binding is unavailable.");
      return { refund: replay, shouldExecute: false };
    }
    const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!currentPayment || !["captured", "partially_refunded"].includes(currentPayment.status || "")) throw new import_graphql7.GraphQLError("Payment is no longer refundable.");
    const reservedRefunds = await tx.refund.aggregate({ where: { paymentId: payment.id, status: { in: ["requested", "processing", "succeeded"] } }, _sum: { amountMinor: true } });
    const alreadyReserved = reservedRefunds._sum.amountMinor || 0;
    if (currentPayment.amountMinor == null || amount > currentPayment.amountMinor - alreadyReserved) throw new import_graphql7.GraphQLError("Refund amount exceeds the available balance after pending reservations.");
    const refund = await tx.refund.create({ data: {
      paymentId: payment.id,
      providerId: provider.id,
      amountMinor: amount,
      currencyCode: payment.currencyCode,
      reason,
      status: "processing",
      idempotencyKey
    } });
    await tx.tripEvent.create({ data: { tripId: authority.header.id, eventType: "finance.refund_reserved", actorType: "operator", actorUserId: context.session.itemId, idempotencyKey, occurredAt: /* @__PURE__ */ new Date(), metadata: { commandBinding, refundId: refund.id, providerId: provider.id } } });
    return { refund, shouldExecute: true };
  }, { isolationLevel: "Serializable" });
  if (!reservation.shouldExecute) return reservation.refund;
  let evidence;
  try {
    evidence = await executePaymentAdapter({ provider, functionName: "refundPaymentFunction", args: { paymentId: payment.providerReference, amount, currency: payment.currencyCode, idempotencyKey } });
  } catch {
    await appendObservation(prisma, payment.id, { observationId: `${reservation.refund.id}:result`, refundId: reservation.refund.id, providerId: provider.id, amountMinor: amount, currencyCode: payment.currencyCode, phase: "outcome_indeterminate", observedAt: (/* @__PURE__ */ new Date()).toISOString() });
    throw new import_graphql7.GraphQLError("Refund outcome is indeterminate. Its balance remains reserved pending reconciliation; do not submit a new key.");
  }
  const status = evidence.status === "succeeded" ? "succeeded" : "processing";
  await appendObservation(prisma, payment.id, { observationId: `${reservation.refund.id}:result`, refundId: reservation.refund.id, providerId: provider.id, amountMinor: amount, currencyCode: payment.currencyCode, phase: status, externalId: String(evidence.externalId || "").slice(0, 200), observedAt: (/* @__PURE__ */ new Date()).toISOString() });
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${payment.id}`}, 0))::text IS NOT NULL`;
    const original = await tx.refund.findUnique({ where: { id: reservation.refund.id } });
    if (!original || original.paymentId !== payment.id || original.providerId !== provider.id || original.idempotencyKey !== idempotencyKey) throw new import_graphql7.GraphQLError("Original refund binding is unavailable.");
    if (original.status === "succeeded") return original;
    if (original.status !== status) assertTransition("refund", original.status, status, "refund");
    const refund = await tx.refund.update({ where: { id: original.id }, data: {
      status,
      providerReference: String(evidence.externalId || ""),
      processedAt: status === "succeeded" ? /* @__PURE__ */ new Date() : null
    } });
    if (status === "succeeded") {
      const current = await tx.payment.findUnique({ where: { id: payment.id } });
      const totalSucceeded = await tx.refund.aggregate({ where: { paymentId: payment.id, status: "succeeded" }, _sum: { amountMinor: true } });
      if (!current || current.amountMinor == null || (totalSucceeded._sum.amountMinor || 0) > current.amountMinor) throw new import_graphql7.GraphQLError("Refund evidence exceeds original tender; reconciliation is required.");
      const nextStatus = (totalSucceeded._sum.amountMinor || 0) === current.amountMinor ? "refunded" : "partially_refunded";
      assertTransition("payment", current.status, nextStatus, "payment");
      await tx.payment.update({ where: { id: payment.id }, data: { status: nextStatus } });
      await bookRefundLedger(tx, refund, current, "refund_call");
    }
    return refund;
  }, { isolationLevel: "Serializable" });
}
async function bookRefundLedger(tx, refund, payment, source) {
  if (refund.amountMinor == null || refund.amountMinor <= 0) return;
  const entryKey = `refund:${refund.id}:succeeded`;
  if (await tx.ledgerEntry.findUnique({ where: { entryKey }, select: { id: true } })) return;
  await tx.ledgerEntry.create({ data: { tripId: payment.tripId, paymentId: payment.id, entryKey, kind: "refund", account: "rider_receivable", direction: "debit", amountMinor: refund.amountMinor, currencyCode: refund.currencyCode, memo: "Refunded to card", metadata: { source } } });
}
async function settleRefund(prisma, args) {
  return prisma.$transaction(async (tx) => {
    const header = await tx.refund.findUnique({ where: { id: args.refundId }, select: { paymentId: true } });
    if (!header?.paymentId) return { settled: false, reason: "unknown_refund" };
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${header.paymentId}`}, 0))::text IS NOT NULL`;
    const refund = await tx.refund.findUnique({ where: { id: args.refundId } });
    if (!refund) return { settled: false, reason: "unknown_refund" };
    if (refund.status === args.status) return { settled: false, reason: "already_settled" };
    if (!["requested", "processing"].includes(refund.status || "")) return { settled: false, reason: "already_settled" };
    assertTransition("refund", refund.status, args.status, "refund");
    await tx.refund.update({ where: { id: refund.id }, data: { status: args.status, ...args.externalId ? { providerReference: args.externalId } : {}, processedAt: args.status === "succeeded" ? /* @__PURE__ */ new Date() : null } });
    await tx.paymentObservation.create({ data: { paymentId: header.paymentId, refundId: refund.id, observationKey: (0, import_node_crypto7.randomUUID)(), details: { phase: args.status, source: args.source, externalId: args.externalId || refund.providerReference || null, observedAt: (/* @__PURE__ */ new Date()).toISOString() } } });
    if (args.status === "succeeded") {
      const payment = await tx.payment.findUnique({ where: { id: header.paymentId } });
      const total = await tx.refund.aggregate({ where: { paymentId: header.paymentId, status: "succeeded" }, _sum: { amountMinor: true } });
      const refunded = total._sum.amountMinor || 0;
      if (!payment || payment.amountMinor == null || refunded > payment.amountMinor) throw new import_graphql7.GraphQLError("Refund evidence exceeds original tender; reconciliation is required.");
      const next = refunded === payment.amountMinor ? "refunded" : "partially_refunded";
      if (payment.status !== next) {
        assertTransition("payment", payment.status, next, "payment");
        await tx.payment.update({ where: { id: payment.id }, data: { status: next } });
      }
      await bookRefundLedger(tx, refund, payment, args.source);
    }
    return { settled: true, status: args.status };
  }, { isolationLevel: "Serializable" });
}

// features/keystone/mutations/driverEarnings.ts
var MAX_DAYS = 93;
var MAX_TRIPS = 5e3;
function period(from, to) {
  const end = to ? /* @__PURE__ */ new Date(`${to}T23:59:59.999Z`) : /* @__PURE__ */ new Date();
  const start = from ? /* @__PURE__ */ new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 6 * 864e5 - end.getTime() % 864e5);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error("Choose a valid date range.");
  if (end.getTime() - start.getTime() > MAX_DAYS * 864e5) throw new Error(`Choose a range of ${MAX_DAYS} days or less.`);
  return { start, end };
}
var PAID = ["captured", "partially_refunded", "refunded"];
var MAX_ENGAGED_SECONDS = 12 * 3600;
function engagedSeconds(trip) {
  if (!trip.completedAt) return 0;
  const end = trip.completedAt.getTime();
  for (const from of [trip.enRouteAt, trip.acceptedAt, trip.startedAt]) {
    if (!from) continue;
    const seconds = Math.round((end - from.getTime()) / 1e3);
    if (seconds >= 0 && seconds <= MAX_ENGAGED_SECONDS) return seconds;
  }
  return 0;
}
async function driverEarningsReport(_root, args, context) {
  if (!humanSessionId(context.session)) throw new Error("Authentication is required.");
  const global = await isGlobalAdministrator({ context, session: context.session });
  const fleetIds = global ? null : await fleetIdsFor(context, context.session, "finance");
  if (fleetIds && fleetIds.length === 0) throw new Error("Finance access is required.");
  const { start, end } = period(args.from, args.to);
  const prisma = context.prisma;
  const fleetWhere = fleetIds ? { fleetId: { in: fleetIds } } : {};
  const trips = await prisma.trip.findMany({
    where: { ...fleetWhere, driverId: { not: null }, OR: [{ status: "completed", completedAt: { gte: start, lte: end } }, { status: { in: ["cancelled", "no_show"] }, updatedAt: { gte: start, lte: end } }] },
    take: MAX_TRIPS + 1,
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      status: true,
      acceptedAt: true,
      enRouteAt: true,
      startedAt: true,
      completedAt: true,
      bookingSnapshot: true,
      finalFareSnapshot: true,
      driver: { select: { id: true, publicName: true } },
      cancellations: { select: { feeMinor: true, currencyCode: true } },
      payments: { select: { status: true, amountMinor: true, currencyCode: true, purpose: true, refunds: { where: { status: "succeeded" }, select: { amountMinor: true } } } }
    }
  });
  const truncated = trips.length > MAX_TRIPS;
  const rows = /* @__PURE__ */ new Map();
  for (const trip of trips.slice(0, MAX_TRIPS)) {
    if (!trip.driver) continue;
    const snapshot = trip.finalFareSnapshot ? { quote: trip.finalFareSnapshot } : trip.bookingSnapshot;
    let fare = null;
    try {
      fare = moneySnapshot(snapshot);
    } catch {
      fare = null;
    }
    const completed = trip.status === "completed";
    const fees = (trip.cancellations || []).reduce((sum, c) => sum + (c.feeMinor || 0), 0);
    const currency = fare?.currency || trip.cancellations?.[0]?.currencyCode || trip.payments?.[0]?.currencyCode || "USD";
    if (!completed && fees === 0) continue;
    const key = `${trip.driver.id}:${currency}`;
    const row = rows.get(key) || { driverId: trip.driver.id, driverName: trip.driver.publicName || "Driver", currencyCode: currency, trips: 0, onTripSeconds: 0, faresMinor: 0, feesMinor: 0, collectedMinor: 0, refundedMinor: 0, uncollectedMinor: 0 };
    if (completed) {
      row.trips += 1;
      row.faresMinor += fare?.amount || 0;
      row.onTripSeconds += engagedSeconds(trip);
    }
    row.feesMinor += fees;
    const due = (completed ? fare?.amount || 0 : 0) + fees;
    let collected = 0;
    let refunded = 0;
    for (const payment of trip.payments || []) {
      if (!PAID.includes(payment.status || "") || payment.currencyCode && payment.currencyCode !== currency) continue;
      collected += payment.amountMinor || 0;
      refunded += (payment.refunds || []).reduce((sum, r) => sum + (r.amountMinor || 0), 0);
    }
    row.collectedMinor += collected;
    row.refundedMinor += refunded;
    row.uncollectedMinor += Math.max(0, due - collected);
    rows.set(key, row);
  }
  const drivers = [...rows.values()].sort((a, b) => b.faresMinor + b.feesMinor - (a.faresMinor + a.feesMinor) || a.driverName.localeCompare(b.driverName));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), truncated, drivers };
}

// features/keystone/mutations/operatorBooking.ts
var import_graphql9 = require("graphql");
init_access();

// features/keystone/mutations/savedCards.ts
var import_node_crypto8 = require("node:crypto");
init_access();
init_stripe();
var STRIPE_CODE = "pp_stripe";
var ACTIVE = ["pending", "authorized", "captured", "partially_refunded"];
var MEMO = { fare: "Fare, charged to the saved card", cancellation_fee: "Cancellation fee, charged to the saved card", no_show_fee: "No-show fee, charged to the saved card" };
var cardView = (profile) => profile?.cardPaymentMethodId && profile.cardLast4 ? { brand: profile.cardBrand || "card", last4: profile.cardLast4, expMonth: profile.cardExpMonth ?? null, expYear: profile.cardExpYear ?? null } : null;
async function stripeEnabled(prisma) {
  if (!stripeSecretKey()) return false;
  const provider = await prisma.paymentProvider.findUnique({ where: { code: STRIPE_CODE }, select: { isInstalled: true, createPaymentFunction: true } });
  return provider?.isInstalled === "yes" && provider.createPaymentFunction === "stripe";
}
async function requireRider(context) {
  const actor = await currentHumanActor(context.prisma, context.session);
  if (!actor) throw new RideshareRefusal("Sign in to save a card.");
  return actor.id;
}
function savedCardFor(prisma, userId) {
  if (!userId) return Promise.resolve(null);
  return prisma.riderProfile.findUnique({ where: { userId }, select: { id: true, stripeCustomerId: true, cardPaymentMethodId: true, cardBrand: true, cardLast4: true, cardExpMonth: true, cardExpYear: true } });
}
function returnPath(value) {
  const path = typeof value === "string" && /^\/[A-Za-z0-9/_\-.]*$/.test(value) && !value.startsWith("//") ? value : "/account";
  return path.slice(0, 200);
}
async function riderSavedCard(_root, _args, context) {
  const actor = await currentHumanActor(context.prisma, context.session);
  const enabled = await stripeEnabled(context.prisma);
  if (!actor) return { enabled, card: null };
  return { enabled, card: cardView(await savedCardFor(context.prisma, actor.id)) };
}
async function startRiderCardSetup(_root, args, context) {
  const userId = await requireRider(context);
  if (!await stripeEnabled(context.prisma)) throw new RideshareRefusal("Saving a card isn\u2019t available here yet.");
  const origin = requestBaseUrl(context.req);
  if (!origin) throw new RideshareRefusal("Saving a card needs the storefront address.");
  const user = await context.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const profile = await savedCardFor(context.prisma, userId);
  let customerId = profile?.stripeCustomerId || "";
  if (!customerId) {
    customerId = (await createStripeCustomer({ email: user?.email, name: user?.name, userId })).id;
    await context.prisma.riderProfile.upsert({ where: { userId }, create: { userId, displayName: user?.name || "", stripeCustomerId: customerId }, update: { stripeCustomerId: customerId } });
  }
  const path = returnPath(args.returnTo);
  const join2 = path.includes("?") ? "&" : "?";
  const session2 = await createCardSetupSession({ customerId, userId, successUrl: `${origin}${path}${join2}card_setup={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}${path}${join2}card_setup=cancelled` });
  if (!session2.url) throw new RideshareRefusal("Card setup couldn\u2019t start. Try again in a moment.");
  return { url: session2.url };
}
async function confirmRiderCardSetup(_root, args, context) {
  const userId = await requireRider(context);
  const profile = await savedCardFor(context.prisma, userId);
  if (!profile?.stripeCustomerId) throw new RideshareRefusal("No card setup is in progress.");
  const session2 = await retrieveSetupSession(String(args.sessionId || ""));
  const intent = typeof session2.setup_intent === "object" ? session2.setup_intent : null;
  if (session2.mode !== "setup" || session2.metadata?.userId !== userId || session2.client_reference_id !== userId || session2.customer !== profile.stripeCustomerId) throw new RideshareRefusal("This card setup belongs to another account.");
  if (session2.status !== "complete" || intent?.status !== "succeeded") return { saved: false, card: cardView(profile) };
  const method = typeof intent.payment_method === "object" ? intent.payment_method : null;
  if (!method?.id || !method.card?.last4) throw new RideshareRefusal("The card couldn\u2019t be read back from Stripe.");
  if (profile.cardPaymentMethodId === method.id) return { saved: true, card: cardView(profile) };
  const previous = profile.cardPaymentMethodId;
  const updated = await context.prisma.riderProfile.update({ where: { userId }, data: { cardPaymentMethodId: method.id, cardBrand: method.card.brand || "card", cardLast4: method.card.last4, cardExpMonth: method.card.exp_month ?? null, cardExpYear: method.card.exp_year ?? null, cardSavedAt: /* @__PURE__ */ new Date() } });
  if (previous) await detachPaymentMethod(previous).catch(() => {
  });
  const declined = await context.prisma.payment.findMany({ where: { status: "failed", trip: { riderId: userId }, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } }, select: { id: true, tripId: true, purpose: true, providerEvidence: true }, take: 5 });
  for (const payment of declined) {
    if (payment.providerEvidence?.source !== "saved_card") continue;
    if (await context.prisma.payment.findFirst({ where: { tripId: payment.tripId, purpose: payment.purpose, status: { in: ACTIVE } }, select: { id: true } })) continue;
    await attempt(context.prisma, payment.id, updated, true).catch(() => {
    });
  }
  return { saved: true, card: cardView(updated) };
}
async function removeRiderCard(_root, _args, context) {
  const userId = await requireRider(context);
  const profile = await savedCardFor(context.prisma, userId);
  if (!profile?.cardPaymentMethodId) return { removed: false };
  await context.prisma.riderProfile.update({ where: { userId }, data: { cardPaymentMethodId: "", cardBrand: "", cardLast4: "", cardExpMonth: null, cardExpYear: null, cardSavedAt: null } });
  await detachPaymentMethod(profile.cardPaymentMethodId).catch(() => {
  });
  return { removed: true };
}
async function chargeDue(prisma, due) {
  try {
    if (!Number.isSafeInteger(due.amountMinor) || due.amountMinor <= 0 || !/^[A-Z]{3}$/.test(due.currencyCode)) return { skipped: "nothing_due" };
    if (!await stripeEnabled(prisma)) return { skipped: "stripe_off" };
    const trip = await prisma.trip.findUnique({ where: { id: due.tripId }, select: { id: true, riderId: true, confirmationCode: true } });
    const profile = await savedCardFor(prisma, trip?.riderId);
    if (!trip || !profile?.cardPaymentMethodId || !profile.stripeCustomerId) return { skipped: "no_card" };
    const provider = await prisma.paymentProvider.findUnique({ where: { code: STRIPE_CODE }, select: { id: true } });
    const reserved = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment-init:${trip.id}`}, 0))::text IS NOT NULL`;
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: due.key } });
      if (existing) return { payment: existing, fresh: false };
      if (due.purpose === "fare" && await tx.payment.findFirst({ where: { tripId: trip.id, purpose: "fare", status: { in: ACTIVE } }, select: { id: true } })) return null;
      const payment = await tx.payment.create({ data: {
        tripId: trip.id,
        providerId: provider.id,
        purpose: due.purpose,
        amountMinor: due.amountMinor,
        currencyCode: due.currencyCode,
        status: "pending",
        idempotencyKey: due.key,
        providerEvidence: { source: "saved_card", phase: "intent_recorded", card: { brand: profile.cardBrand, last4: profile.cardLast4 }, disclosure: "No money movement has been verified." }
      } });
      return { payment, fresh: true };
    }, { isolationLevel: "Serializable" });
    if (!reserved) return { skipped: "already_paid" };
    if (!reserved.fresh && reserved.payment.status !== "pending") return { status: reserved.payment.status, paymentId: reserved.payment.id };
    return await attempt(prisma, reserved.payment.id, profile, false);
  } catch (error) {
    return { skipped: "error", message: error instanceof Error ? error.message.slice(0, 200) : "unknown" };
  }
}
async function attempt(prisma, paymentId, profile, again) {
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${paymentId}`}, 0))::text IS NOT NULL`;
    const payment2 = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment2) return null;
    if (again ? payment2.status !== "failed" : payment2.status !== "pending") return { payment: payment2, run: false };
    const resend = !again && Boolean(payment2.attempts);
    const attempts = again || !payment2.attempts ? (payment2.attempts || 0) + 1 : payment2.attempts;
    const evidence = payment2.providerEvidence || {};
    const updated = await tx.payment.update({ where: { id: paymentId }, data: { status: "pending", attempts, ...again ? { providerReference: "" } : {}, lastAttemptAt: /* @__PURE__ */ new Date(), providerEvidence: { ...evidence, card: { brand: profile.cardBrand ?? null, last4: profile.cardLast4 ?? null } } } });
    return { payment: updated, run: true, resend, since: payment2.createdAt || /* @__PURE__ */ new Date(0) };
  }, { isolationLevel: "Serializable" });
  if (!claimed) return { skipped: "missing" };
  if (!claimed.run) return { status: claimed.payment.status, paymentId };
  const payment = claimed.payment;
  const trip = payment.tripId ? await prisma.trip.findUnique({ where: { id: payment.tripId }, select: { confirmationCode: true } }) : null;
  let intent;
  try {
    const earlier = claimed.resend ? await findSavedCardIntent(profile.stripeCustomerId, payment.id, payment.attempts, claimed.since) : null;
    intent = earlier ?? await chargeSavedCard({
      customerId: profile.stripeCustomerId,
      paymentMethodId: profile.cardPaymentMethodId,
      amount: payment.amountMinor,
      currency: payment.currencyCode,
      description: `${MEMO[payment.purpose || "fare"].split(",")[0]} \xB7 ${trip?.confirmationCode || "ride"}`,
      metadata: { tripId: payment.tripId || "", paymentId: payment.id, purpose: payment.purpose || "fare", attempt: String(payment.attempts) },
      idempotencyKey: `saved-card:${payment.id}:${payment.attempts}`
    });
  } catch {
    await observe(prisma, payment.id, { phase: "outcome_indeterminate", attempt: payment.attempts });
    return { status: "pending", paymentId };
  }
  return settleIntent(prisma, payment, intent);
}
async function settleIntent(prisma, payment, intent) {
  const succeeded = intent.status === "succeeded";
  const processing = intent.status === "processing";
  const decline = intent.last_payment_error;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${payment.id}`}, 0))::text IS NOT NULL`;
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!current || current.status !== "pending") return;
    if (succeeded) {
      if (intent.amount !== current.amountMinor || intent.currency?.toUpperCase() !== current.currencyCode) throw new RideshareRefusal("Stripe charged a different amount; reconciliation is required.");
      await tx.payment.update({ where: { id: current.id }, data: { status: "captured", capturedAt: /* @__PURE__ */ new Date(), providerReference: intent.id, failureCode: "", failureMessage: "" } });
      await tx.ledgerEntry.create({ data: { tripId: current.tripId, paymentId: current.id, entryKey: `payment:${current.id}:captured`, kind: "rider_charge", account: "rider_receivable", direction: "credit", amountMinor: current.amountMinor, currencyCode: current.currencyCode, memo: MEMO[current.purpose || "fare"], metadata: { paymentIntentId: intent.id, attempt: current.attempts } } });
    } else if (!processing) {
      await tx.payment.update({ where: { id: current.id }, data: { status: "failed", providerReference: intent.id, failureCode: String(decline?.decline_code || decline?.code || intent.status).slice(0, 80), failureMessage: String(decline?.message || "The card was not charged.").slice(0, 300) } });
    } else {
      await tx.payment.update({ where: { id: current.id }, data: { providerReference: intent.id } });
    }
    await tx.paymentObservation.create({ data: { paymentId: current.id, observationKey: (0, import_node_crypto8.randomUUID)(), details: { phase: succeeded ? "captured" : processing ? "processing" : "failed", source: "saved_card", paymentIntentId: intent.id, attempt: current.attempts, failureCode: decline?.decline_code || decline?.code || null, amountMinor: current.amountMinor, currencyCode: current.currencyCode, observedAt: (/* @__PURE__ */ new Date()).toISOString() } } });
  }, { isolationLevel: "Serializable" });
  return { status: succeeded ? "captured" : processing ? "pending" : "failed", paymentId: payment.id };
}
async function observe(prisma, paymentId, details) {
  await prisma.paymentObservation.create({ data: { paymentId, observationKey: (0, import_node_crypto8.randomUUID)(), details: { source: "saved_card", observedAt: (/* @__PURE__ */ new Date()).toISOString(), ...details } } }).catch(() => {
  });
}
async function retryTripCharge(_root, args, context) {
  const prisma = context.prisma;
  const header = await prisma.payment.findUnique({ where: { id: args.paymentId }, select: { id: true, tripId: true, status: true, providerReference: true, providerEvidence: true, provider: { select: { code: true } } } });
  const authority = header?.tripId ? await authorizedTripHeader(prisma, context.session, header.tripId, "operator", "finance") : null;
  if (!header || !authority?.operator) throw new RideshareRefusal("Payment not found.");
  if (header.provider?.code !== STRIPE_CODE || header.providerEvidence?.source !== "saved_card") throw new RideshareRefusal("Only saved-card charges can be retried here.");
  if (!["failed", "pending"].includes(header.status || "")) throw new RideshareRefusal("This charge is not waiting for a retry.");
  const trip = await prisma.trip.findUnique({ where: { id: header.tripId }, select: { riderId: true } });
  const profile = await savedCardFor(prisma, trip?.riderId);
  if (!profile?.cardPaymentMethodId || !profile.stripeCustomerId) throw new RideshareRefusal("The rider has no saved card. Record the payment another way.");
  if (header.status === "pending" && header.providerReference?.startsWith("pi_")) {
    const intent = await retrievePaymentIntent(header.providerReference);
    const payment = await prisma.payment.findUnique({ where: { id: header.id } });
    const result2 = await settleIntent(prisma, payment, intent);
    return { status: result2.status };
  }
  if (header.status === "failed" && await prisma.payment.findFirst({ where: { tripId: header.tripId, id: { not: header.id }, purpose: (await prisma.payment.findUnique({ where: { id: header.id }, select: { purpose: true } }))?.purpose, status: { in: ACTIVE } }, select: { id: true } })) throw new RideshareRefusal("This charge was already paid another way.");
  const result = await attempt(prisma, header.id, profile, header.status === "failed");
  return { status: result.status || "failed" };
}
async function savedCardFare(prisma, tripId, riderId) {
  const [profile, payment] = await Promise.all([
    savedCardFor(prisma, riderId),
    prisma.payment.findFirst({ where: { tripId, purpose: "fare" }, orderBy: { createdAt: "desc" }, select: { status: true, failureMessage: true, providerEvidence: true } })
  ]);
  const source = payment?.providerEvidence?.source;
  return { savedCard: cardView(profile), failure: source === "saved_card" && payment?.status === "failed" ? payment.failureMessage || "The card was declined." : null };
}

// features/keystone/mutations/autoDispatch.ts
init_autoDispatchRanking();
var AUTO_DISPATCH_ACTOR = "system:auto-dispatch";
var AUTO_OFFER_SECONDS = 60;
var recent = /* @__PURE__ */ new Map();
function pickupOf(quote) {
  const point = quote?.routeEvidence?.pickup;
  return Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === "number" && Number.isFinite(value)) ? [point[0], point[1]] : null;
}
async function advanceAutoDispatch(prisma, requestId, { throttleMs = 0 } = {}) {
  if (throttleMs) {
    const last2 = recent.get(requestId) || 0;
    if (Date.now() - last2 < throttleMs) return { offered: false, reason: "throttled" };
    recent.set(requestId, Date.now());
    if (recent.size > 5e3) {
      for (const [key, at] of recent) if (Date.now() - at > 6e4) recent.delete(key);
    }
  }
  try {
    return await advance(prisma, requestId);
  } catch (error) {
    return { offered: false, reason: "error", message: error instanceof Error ? error.message.slice(0, 200) : "unknown" };
  }
}
async function advance(prisma, requestId) {
  const header = await prisma.rideRequest.findUnique({ where: { id: requestId }, select: { id: true, fleetId: true, status: true, requestedFor: true, fleet: { select: { operationsMode: true, status: true } } } });
  if (!header?.fleetId || header.fleet?.operationsMode !== "auto" || header.fleet.status !== "active") return { offered: false, reason: "manual" };
  if (!["requested", "matching"].includes(header.status || "") || header.requestedFor) return { offered: false, reason: "not_waiting" };
  await releaseElapsedOffers(prisma, { fleetId: header.fleetId, requestId });
  const now = /* @__PURE__ */ new Date();
  const live = await prisma.matchOffer.findFirst({ where: { requestId, OR: [{ status: "accepted" }, { status: "offered", expiresAt: { gt: now }, reservationReleasedAt: null }] }, select: { id: true } });
  if (live) return { offered: false, reason: "live_offer" };
  const request = await prisma.rideRequest.findUnique({ where: { id: requestId }, select: { passengerCount: true, accessibilityNeeds: true, matchOffers: { select: { driverId: true } }, quote: { select: { routeEvidence: true, service: { select: { status: true, passengerCapacity: true, wheelchairAccessible: true } } } } } });
  const service = request?.quote?.service;
  if (!request || !service || service.status !== "active") return { offered: false, reason: "not_waiting" };
  const pickup = pickupOf(request.quote);
  const tried = new Set(request.matchOffers.map((offer) => offer.driverId).filter(Boolean));
  const needs = request.accessibilityNeeds && typeof request.accessibilityNeeds === "object" && !Array.isArray(request.accessibilityNeeds) ? request.accessibilityNeeds : {};
  const passengers = request.passengerCount || 1;
  const drivers = await prisma.driverProfile.findMany({
    where: { fleetId: header.fleetId, status: "active", dispatchStatus: "available", id: { notIn: [...tried] } },
    select: { id: true, lastLocationLng: true, lastLocationLat: true, lastLocationAt: true },
    take: 200
  });
  const candidates = [];
  for (const driver of drivers) {
    if (!await loadCurrentEligibility(prisma, "driver", driver.id, header.fleetId, now) || !await isCurrentlyAvailableAt(prisma, driver.id, now)) continue;
    const vehicles = await prisma.vehicle.findMany({ where: {
      fleetId: header.fleetId,
      status: "active",
      drivers: { some: { id: driver.id } },
      capacity: { gte: passengers },
      ...needs.wheelchairAccessible === true || service.wheelchairAccessible ? { wheelchairAccessible: true } : {}
    }, orderBy: { id: "asc" }, take: 5, select: { id: true } });
    let vehicleId = null;
    for (const vehicle of vehicles) if (await loadCurrentEligibility(prisma, "vehicle", vehicle.id, header.fleetId, now)) {
      vehicleId = vehicle.id;
      break;
    }
    if (!vehicleId) continue;
    const at = freshLocation(driver, now);
    candidates.push({ driverId: driver.id, vehicleId, km: at && pickup ? distanceKm(at, pickup) : null });
  }
  for (const candidate of rankDrivers(candidates)) {
    try {
      await placeRideOffer(prisma, { requestId, driverId: candidate.driverId, vehicleId: candidate.vehicleId, expiresInSeconds: AUTO_OFFER_SECONDS, idempotencyKey: `auto:${requestId}:${candidate.driverId}` }, {
        actorId: AUTO_DISPATCH_ACTOR,
        onlyOffer: true,
        authorize: async (tx) => Boolean(await tx.fleet.findFirst({ where: { id: header.fleetId, operationsMode: "auto", status: "active" }, select: { id: true } }))
      });
      return { offered: true, driverId: candidate.driverId, km: candidate.km };
    } catch (error) {
      if (error instanceof Error && /already has a live offer|not matchable|Dispatch reservation changed/.test(error.message)) return { offered: false, reason: "live_offer" };
    }
  }
  return { offered: false, reason: candidates.length ? "all_busy" : "no_driver" };
}
async function advanceFleetAutoDispatch(prisma, fleetId, { throttleMs = 0 } = {}) {
  if (!fleetId) return;
  if (throttleMs) {
    const key = `fleet:${fleetId}`;
    if (Date.now() - (recent.get(key) || 0) < throttleMs) return;
    recent.set(key, Date.now());
  }
  try {
    const fleet = await prisma.fleet.findUnique({ where: { id: fleetId }, select: { operationsMode: true } });
    if (fleet?.operationsMode !== "auto") return;
    const waiting = await prisma.rideRequest.findMany({ where: { fleetId, status: { in: ["requested", "matching"] }, requestedFor: null, createdAt: { gt: new Date(Date.now() - 2 * 60 * 6e4) } }, orderBy: { createdAt: "asc" }, take: 10, select: { id: true } });
    for (const request of waiting) await advanceAutoDispatch(prisma, request.id);
  } catch {
  }
}
async function reportDriverLocation(_root, args, context) {
  const { currentHumanActor: currentHumanActor2 } = await Promise.resolve().then(() => (init_access(), access_exports));
  const { coarsePoint: coarsePoint2 } = await Promise.resolve().then(() => (init_autoDispatchRanking(), autoDispatchRanking_exports));
  const actor = await currentHumanActor2(context.prisma, context.session);
  if (!actor) throw new Error("Sign in as a driver.");
  const point = coarsePoint2(args.lng, args.lat);
  if (!point) throw new Error("Location is invalid.");
  if (args.accuracyMeters != null && (!Number.isFinite(args.accuracyMeters) || args.accuracyMeters > 5e3)) return { saved: false };
  const driver = await context.prisma.driverProfile.findFirst({ where: { userId: actor.id, status: "active" }, select: { id: true, fleetId: true, dispatchStatus: true } });
  if (!driver || driver.dispatchStatus === "offline") return { saved: false };
  await context.prisma.driverProfile.update({ where: { id: driver.id }, data: { lastLocationLng: point[0], lastLocationLat: point[1], lastLocationAt: /* @__PURE__ */ new Date() } });
  if (driver.dispatchStatus === "available") await advanceFleetAutoDispatch(context.prisma, driver.fleetId);
  return { saved: true };
}

// features/keystone/mutations/maintenance.ts
var import_graphql8 = require("graphql");
init_access();
init_stripe();
var ON_DEMAND_WAIT_MS = 2 * 60 * 6e4;
var SCHEDULED_GRACE_MS = LATE_SCHEDULED_GRACE_MS;
var STALE_REFUND_MS = 5 * 6e4;
async function expireStaleRideRequests(prisma, now = /* @__PURE__ */ new Date()) {
  const onDemandBefore = new Date(now.getTime() - ON_DEMAND_WAIT_MS);
  const scheduledBefore = new Date(now.getTime() - SCHEDULED_GRACE_MS);
  const result = await prisma.rideRequest.updateMany({
    where: {
      status: { in: ["requested", "matching"] },
      matchOffers: { none: { status: { in: ["offered", "accepted"] } } },
      OR: [
        { trip: { is: null }, OR: [{ requestedFor: null, createdAt: { lt: onDemandBefore } }, { requestedFor: { lt: scheduledBefore } }] },
        // Sent back for reassignment and nobody took it: timed from when it was reopened.
        { trip: { is: { status: "cancelled" } }, OR: [{ requestedFor: null, updatedAt: { lt: onDemandBefore } }, { requestedFor: { lt: scheduledBefore } }] }
      ]
    },
    data: { status: "expired" }
  });
  return result.count;
}
async function reconcileStaleRefunds(prisma, now = /* @__PURE__ */ new Date()) {
  const rows = await prisma.refund.findMany({
    where: { status: "processing", updatedAt: { lt: new Date(now.getTime() - STALE_REFUND_MS) } },
    orderBy: { updatedAt: "asc" },
    take: 10,
    select: {
      id: true,
      amountMinor: true,
      currencyCode: true,
      providerReference: true,
      idempotencyKey: true,
      provider: { select: { id: true, code: true, isInstalled: true, refundPaymentFunction: true, createPaymentFunction: true, capturePaymentFunction: true, getPaymentStatusFunction: true, handleWebhookFunction: true } },
      payment: { select: { providerReference: true } }
    }
  });
  let settled = 0;
  for (const refund of rows) {
    try {
      if (refund.provider?.code !== "pp_stripe" || refund.provider.isInstalled !== "yes" || !stripeSecretKey()) continue;
      let status;
      let externalId = refund.providerReference;
      if (/^re_/.test(refund.providerReference || "")) {
        const live = await retrieveRefund(refund.providerReference);
        status = live.status;
        externalId = live.id;
      } else {
        const found = refund.payment?.providerReference ? await findRefundByKey(refund.payment.providerReference, refund.idempotencyKey) : null;
        if (found) {
          status = found.status;
          externalId = found.id;
        }
      }
      if (!status) {
        const evidence = await executePaymentAdapter({ provider: refund.provider, functionName: "refundPaymentFunction", args: { paymentId: refund.payment?.providerReference, amount: refund.amountMinor, currency: refund.currencyCode, idempotencyKey: refund.idempotencyKey } });
        status = evidence.status === "succeeded" ? "succeeded" : "pending";
        externalId = String(evidence.externalId || "");
      }
      const final = status === "succeeded" ? "succeeded" : status === "failed" ? "failed" : status === "canceled" ? "cancelled" : null;
      if (!final) continue;
      const result = await settleRefund(prisma, { refundId: refund.id, status: final, externalId: externalId || void 0, source: "stripe_reconcile" });
      if (result.settled) settled++;
    } catch {
    }
  }
  return settled;
}
async function purgeExpiredLocations(prisma, now = /* @__PURE__ */ new Date()) {
  const rows = await prisma.locationEvent.findMany({ where: { expiresAt: { lte: now } }, orderBy: { expiresAt: "asc" }, take: 500, select: { id: true } });
  if (!rows.length) return 0;
  const result = await prisma.locationEvent.deleteMany({ where: { id: { in: rows.map((row) => row.id) }, expiresAt: { lte: now } } });
  return result.count;
}
var last = 0;
var running = false;
function runMaintenance(prisma, { everyMs = 6e4 } = {}) {
  const now = Date.now();
  if (running || now - last < everyMs) return;
  last = now;
  running = true;
  void (async () => {
    for (const step of [expireStaleRideRequests, purgeExpiredLocations]) {
      try {
        await step(prisma);
      } catch (error) {
        console.error("Maintenance step failed:", step.name, error instanceof Error ? error.message : "unknown");
      }
    }
  })().finally(() => {
    running = false;
  });
}
async function refreshRideshareClocks(_root, _args, context) {
  if (!await hasAnyFleetScope(context, context.session, "operations") && !await hasAnyFleetScope(context, context.session, "finance")) throw new import_graphql8.GraphQLError("Not found or outside your access.");
  const prisma = context.prisma;
  return { expiredRequests: await expireStaleRideRequests(prisma), settledRefunds: await reconcileStaleRefunds(prisma), purgedLocations: await purgeExpiredLocations(prisma) };
}

// features/keystone/mutations/paymentTriggers.ts
function bounded(work, ms = 4e3) {
  return Promise.race([work.catch(() => {
  }), new Promise((resolve) => setTimeout(resolve, ms))]);
}
async function fleetOfDriver(prisma, driverId, userId) {
  const driver = driverId ? await prisma.driverProfile.findUnique({ where: { id: driverId }, select: { fleetId: true } }) : userId ? await prisma.driverProfile.findFirst({ where: { userId }, select: { fleetId: true } }) : null;
  return driver?.fleetId || null;
}
function autoDispatchAfter(resolver, kind) {
  return async (root, args, context) => {
    const result = await resolver(root, args, context);
    const prisma = context.prisma;
    if (kind === "request" && result?.requestId && result.replayed === false) await bounded(advanceAutoDispatch(prisma, result.requestId));
    if (kind === "response" && result && result.accepted === false && result.requestId) await bounded((async () => {
      await advanceAutoDispatch(prisma, result.requestId);
      await advanceFleetAutoDispatch(prisma, await fleetOfDriver(prisma, null, context.session?.itemId));
    })());
    if (kind === "online" && args?.online && result?.dispatchStatus === "available") await bounded(advanceFleetAutoDispatch(prisma, await fleetOfDriver(prisma, result.id)));
    return result;
  };
}
function dispatchOnPoll(resolver) {
  return async (root, args, context) => {
    const result = await resolver(root, args, context);
    runMaintenance(context.prisma);
    if (result?.requestId && ["requested", "matching"].includes(result.status)) void advanceAutoDispatch(context.prisma, result.requestId, { throttleMs: 4e3 });
    return result;
  };
}
function dispatchOnDriverRead(resolver) {
  return async (root, args, context) => {
    const result = await resolver(root, args, context);
    runMaintenance(context.prisma);
    if (result?.driver?.id && result.driver.status === "active") void fleetOfDriver(context.prisma, result.driver.id).then((fleetId) => advanceFleetAutoDispatch(context.prisma, fleetId, { throttleMs: 5e3 }));
    return result;
  };
}
function chargeAfterTransition(resolver) {
  return async (root, args, context) => {
    const result = await resolver(root, args, context);
    const prisma = context.prisma;
    if (!result?.id || !["completed", "no_show"].includes(result.status)) return result;
    await bounded((async () => {
      const trip = await prisma.trip.findUnique({ where: { id: result.id }, select: { id: true, status: true, bookingSnapshot: true, fleetId: true, cancellations: { where: { reasonCode: "rider_no_show" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, feeMinor: true, currencyCode: true } } } });
      if (trip?.status === "completed") {
        let money4 = null;
        try {
          money4 = moneySnapshot(trip.bookingSnapshot);
        } catch {
        }
        if (money4) await chargeDue(prisma, { tripId: trip.id, purpose: "fare", amountMinor: money4.amount, currencyCode: money4.currency, key: `saved-card:fare:${trip.id}` });
      }
      const fee = trip?.status === "no_show" ? trip.cancellations[0] : null;
      if (fee) await chargeDue(prisma, { tripId: trip.id, purpose: "no_show_fee", amountMinor: fee.feeMinor || 0, currencyCode: fee.currencyCode, key: `saved-card:no-show:${fee.id}` });
      await advanceFleetAutoDispatch(prisma, trip?.fleetId);
    })(), 15e3);
    return result;
  };
}
function chargeAfterCancel(resolver) {
  return async (root, args, context) => {
    const result = await resolver(root, args, context);
    const prisma = context.prisma;
    if (!result?.id || !result.tripId) return result;
    await bounded((async () => {
      if (result.actorType === "rider" && result.feeMinor > 0) await chargeDue(prisma, { tripId: result.tripId, purpose: "cancellation_fee", amountMinor: result.feeMinor, currencyCode: result.currencyCode, key: `saved-card:cancel:${result.id}` });
      const trip = await prisma.trip.findUnique({ where: { id: result.tripId }, select: { fleetId: true, requestId: true } });
      if (args?.reassign && trip?.requestId) await advanceAutoDispatch(prisma, trip.requestId);
      await advanceFleetAutoDispatch(prisma, trip?.fleetId);
    })(), 15e3);
    return result;
  };
}

// features/keystone/mutations/operatorBooking.ts
init_request_confirmation();
var KEY = /^[A-Za-z0-9_-]{32,64}$/;
var bad = (message) => new import_graphql9.GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
function phoneBookingNotes(args) {
  const name = String(args.riderName ?? "").trim().replace(/\s+/g, " ");
  const phone = String(args.riderPhone ?? "").trim();
  if (!name || name.length > 120) throw bad("Enter the caller\u2019s name.");
  if (!/^\+?[0-9 ().-]{7,24}$/.test(phone) || phone.replace(/\D/g, "").length < 7) throw bad("Enter a callback phone number.");
  const notes = String(args.notes ?? "").trim();
  const text14 = `Phone booking \xB7 ${name} \xB7 ${phone}${notes ? ` \xB7 ${notes}` : ""}`;
  if (text14.length > 1e3) throw bad("Notes are too long.");
  return text14;
}
async function createOperatorRide(_root, args, context) {
  if (!humanSessionId(context.session)) throw new Error("Authentication is required.");
  if (typeof args.idempotencyKey !== "string" || !KEY.test(args.idempotencyKey)) throw bad("Request key is invalid.");
  const service = await context.prisma.rideService.findUnique({ where: { id: String(args.serviceId || "") }, select: { id: true, fleetId: true } });
  if (!service?.fleetId || !await canAccessFleet(context, context.session, service.fleetId, "operations")) throw bad("Choose a service you dispatch for.");
  const riderNotes = phoneBookingNotes(args);
  const receiptEmail = normalizeReceiptEmail(args.receiptEmail);
  const handoffId = `phone:${args.idempotencyKey}`;
  const prior = await context.prisma.rideQuote.findFirst({ where: { handoffId }, select: { request: { select: { id: true, requestNumber: true, status: true, fleetId: true } } } });
  if (prior?.request) {
    if (prior.request.fleetId !== service.fleetId) throw bad("Request key belongs to a different booking.");
    return { requestId: prior.request.id, requestNumber: prior.request.requestNumber, status: prior.request.status, replayed: true };
  }
  if (prior) throw new import_graphql9.GraphQLError("This booking was started but not placed. Start a new booking.", { extensions: { code: "BAD_USER_INPUT" } });
  const guest = context.withSession(void 0);
  const quote = await marketplaceRideshareQuote(null, {
    serviceId: service.id,
    pickupLabel: args.pickupLabel,
    dropoffLabel: args.dropoffLabel,
    pickupPoint: args.pickupPoint ?? null,
    dropoffPoint: args.dropoffPoint ?? null,
    scheduledFor: args.scheduledFor || null,
    passengerCount: args.passengerCount ?? 1,
    wheelchairAccessible: args.wheelchairAccessible ?? false,
    handoffId
  }, guest);
  const placed = await autoDispatchAfter(requestRide, "request")(null, {
    quoteId: quote.quoteId,
    quoteProof: quote.quoteProof,
    passengerCount: args.passengerCount ?? 1,
    accessibilityNeeds: { wheelchairAccessible: args.wheelchairAccessible === true },
    riderNotes,
    receiptEmail
  }, guest);
  return { requestId: placed.requestId, requestNumber: placed.requestNumber, status: placed.status, replayed: false, fare: quote.fare, scheduledFor: quote.scheduledFor };
}

// features/keystone/mutations/tripOperations.ts
var import_graphql10 = require("graphql");
var import_node_crypto9 = require("node:crypto");
var import_node_util5 = require("node:util");
init_access();
var createReviewBodyHash = (body) => (0, import_node_crypto9.createHash)("sha256").update(body).digest("hex");
async function loadAuthorizedTrip(context, args, capability = "operations", purpose = "participant") {
  if (!humanSessionId(context.session)) throw new import_graphql10.GraphQLError("Trip not found.");
  const authority = await authorizedTripHeader(context.prisma, context.session, args.tripId, purpose, capability);
  if (!authority) throw new import_graphql10.GraphQLError(purpose === "reviewParticipant" ? "Only the assigned rider or driver may submit a review." : "Trip not found.");
  if (!authority.bound) throw new import_graphql10.GraphQLError("Trip binding is unavailable; reconcile the retained trip.");
  const trip = await context.prisma.trip.findFirst({ where: tripAuthorityWhere(authority.header), select: {
    ...tripAuthoritySelect,
    confirmationCode: true,
    status: true,
    bookingSnapshot: true,
    rider: { select: { id: true } },
    driver: { select: { id: true, status: true, fleet: { select: { id: true } }, user: { select: { id: true } } } },
    vehicle: { select: { id: true } },
    fleet: { select: { id: true } },
    request: { select: { id: true, status: true } },
    acceptedOffer: { select: { id: true, driver: { select: { id: true } } } },
    conversation: { select: { id: true, status: true } }
  } });
  if (!trip) throw new import_graphql10.GraphQLError("Trip not found.");
  return trip;
}
async function tripCancellationPreview(_root, args, context) {
  return context.prisma.$transaction(async (tx) => {
    await fenceHumanAuthority(tx, context.session);
    const authority = await authorizedTripHeader(tx, context.session, args.tripId, "participant");
    if (!authority?.bound) return null;
    const trip = await tx.trip.findFirst({ where: tripAuthorityWhere(authority.header), include: { request: true } });
    if (!trip || !["driver_assigned", "driver_en_route", "driver_arrived"].includes(trip.status)) return null;
    const economics = requireAcceptedQuoteFee(trip.bookingSnapshot, trip.request?.quoteSnapshot, "cancellationFeeMinor");
    return { tripId: trip.id, actorId: authority.actorId, acceptedOfferId: trip.acceptedOfferId, updatedAt: trip.updatedAt.toISOString(), feeMinor: economics.feeMinor, currencyCode: economics.currencyCode, refundRequired: "manual_review" };
  }, { isolationLevel: "RepeatableRead" });
}
async function riderRequestCancellationPreview(_root, args, context) {
  return context.prisma.$transaction(async (tx) => {
    const header = await authorizedRequestHeader(tx, context.session, args.requestId, args.requestProof);
    if (!header) return null;
    const request = await tx.rideRequest.findFirst({ where: requestOwnerWhere(header), select: { id: true, status: true, trip: { select: { status: true } } } });
    if (!request || !["requested", "matching"].includes(request.status) || request.trip && request.trip.status !== "cancelled") return null;
    return { requestId: request.id, actorId: header.riderId || "guest", status: request.status };
  }, { isolationLevel: "RepeatableRead" });
}
async function cancelRideRequest(_root, args, context) {
  if (typeof args.idempotencyKey !== "string" || args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 200) throw new import_graphql10.GraphQLError("A stable idempotency key of 12\u2013200 characters is required.");
  const prisma = context.prisma;
  const authorize = async (db, request) => {
    const actor = humanSessionId(context.session) ? await currentHumanActor(db, context.session) : null;
    const riderOwner = ownsRequest(request, request.riderId ? actor ? context.session : void 0 : context.session, args.requestProof);
    const operator = await canAccessFleet({ prisma: db }, context.session, request.fleetId, "operations");
    return riderOwner || operator;
  };
  const visible = await prisma.rideRequest.findUnique({ where: { id: args.requestId }, select: { id: true, riderId: true, fleetId: true, requestNumber: true, guestProofHash: true, guestProofExpiresAt: true } });
  if (!visible || !await authorize(prisma, visible)) throw new import_graphql10.GraphQLError("Ride request was not found.");
  const visibleOwner = ownsRequest(visible, context.session, args.requestProof);
  const expectedActor = visibleOwner ? visible.riderId || "guest" : humanSessionId(context.session);
  if (!expectedActor || args.expectedActorId !== expectedActor) throw new import_graphql10.GraphQLError("Cancellation actor changed; reconcile the original command.");
  const offerSnapshot = await context.prisma.matchOffer.findMany({ where: { requestId: args.requestId, status: { in: ["offered", "accepted"] } }, select: { driverId: true } });
  const lockedDriverIds = new Set(offerSnapshot.map((offer) => offer.driverId).filter((id) => Boolean(id)));
  const lockKeys = [`command:${args.idempotencyKey}`, ...Array.from(lockedDriverIds, (id) => `driver:${id}`), `request:${args.requestId}`].sort();
  return context.prisma.$transaction(async (tx) => {
    for (const key of lockKeys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text IS NOT NULL`;
    if (humanSessionId(context.session)) await fenceHumanAuthority(tx, context.session, visible.fleetId);
    const header = await tx.rideRequest.findUnique({ where: { id: args.requestId }, select: { id: true, riderId: true, fleetId: true, requestNumber: true, guestProofHash: true, guestProofExpiresAt: true } });
    if (!header || header.fleetId !== visible.fleetId || header.riderId !== visible.riderId || !await authorize(tx, header)) throw new import_graphql10.GraphQLError("Ride request was not found.");
    const recorded = await tx.requestCancellationCommand.findUnique({ where: { idempotencyKey: args.idempotencyKey } });
    if (recorded && recorded.requestId !== header.id) throw new import_graphql10.GraphQLError("Cancellation key belongs to another request.");
    const current = await tx.rideRequest.findFirst({ where: requestOwnerWhere(header), include: { trip: true } });
    if (!current) throw new import_graphql10.GraphQLError("Ride request was not found.");
    const owner = ownsRequest(header, context.session, args.requestProof);
    const actualActor = owner ? header.riderId || "guest" : humanSessionId(context.session);
    if (actualActor !== args.expectedActorId) throw new import_graphql10.GraphQLError("Cancellation actor changed; reconcile the original command.");
    const command = { version: 1, purpose: "request_cancellation", requestId: current.id, fleetId: current.fleetId, actorKind: owner ? header.riderId ? "rider" : "guest" : "operator", actorId: actualActor, ...owner && !header.riderId ? { originalProofHash: header.guestProofHash } : {} };
    if (recorded) {
      if (!(0, import_node_util5.isDeepStrictEqual)(recorded.command, command) || recorded.result?.requestId !== current.id || recorded.result.status !== "cancelled") throw new import_graphql10.GraphQLError("Cancellation key belongs to another command.");
      return { ...recorded.result, replayed: true, alreadyCancelled: false };
    }
    if (current.status === "cancelled") return { requestId: current.id, status: current.status, replayed: false, alreadyCancelled: true };
    if (!["requested", "matching"].includes(current.status || "") || current.trip && current.trip.status !== "cancelled") throw new import_graphql10.GraphQLError("This ride request has already been matched to a trip and must be cancelled through its trip receipt.");
    const result = { requestId: current.id, status: "cancelled", replayed: false, alreadyCancelled: false };
    const requestUpdate = await tx.rideRequest.updateMany({ where: { id: current.id, status: { in: ["requested", "matching"] } }, data: { status: "cancelled" } });
    if (requestUpdate.count !== 1) throw new import_graphql10.GraphQLError("Ride request changed concurrently; reload before retrying.");
    const outstandingOffers = await tx.matchOffer.findMany({ where: { requestId: current.id, status: { in: ["offered", "accepted"] } }, select: { driverId: true } });
    const offeredDriverIds = Array.from(new Set(outstandingOffers.map((offer) => offer.driverId).filter((id) => Boolean(id)))).sort();
    if (offeredDriverIds.some((id) => !lockedDriverIds.has(id))) throw new import_graphql10.GraphQLError("Dispatch offers changed concurrently; reload before retrying cancellation.");
    await tx.matchOffer.updateMany({ where: { requestId: current.id, status: { in: ["offered", "accepted"] } }, data: { status: "withdrawn", respondedAt: /* @__PURE__ */ new Date(), reservationReleasedAt: /* @__PURE__ */ new Date() } });
    for (const driverId of offeredDriverIds) await refreshDriverPresentDispatchStatus(tx, driverId);
    await tx.requestCancellationCommand.create({ data: { requestId: current.id, idempotencyKey: args.idempotencyKey, command, result } });
    return result;
  }, { isolationLevel: "Serializable" });
}
async function cancelRide(_root, args, context) {
  if (typeof args.idempotencyKey !== "string" || args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 200) throw new import_graphql10.GraphQLError("A stable idempotency key of 12\u2013200 characters is required.");
  const initialAuthority = await authorizedTripHeader(context.prisma, context.session, args.tripId, "participant");
  if (!initialAuthority) throw new import_graphql10.GraphQLError("Trip not found.");
  if (args.expectedActorId !== initialAuthority.actorId || args.expectedAcceptedOfferId !== initialAuthority.header.acceptedOfferId) throw new import_graphql10.GraphQLError("Cancellation actor or assignment changed; reconciliation is required.");
  if (!initialAuthority.bound) throw new import_graphql10.GraphQLError("Trip binding is unavailable; reconcile the retained trip.");
  const header = initialAuthority.header;
  await requireFleetOperations(context.prisma, header.fleetId);
  const visible = { id: header.id, driver: header.driverId ? { id: header.driverId } : null, vehicle: header.vehicleId ? { id: header.vehicleId } : null, request: header.requestId ? { id: header.requestId } : null, acceptedOffer: header.acceptedOfferId ? { id: header.acceptedOfferId } : null, fleet: { id: header.fleetId } };
  const actorId = initialAuthority.actorId;
  const reasonCode = String(args.reasonCode || "other").trim().slice(0, 80);
  const reason = String(args.reason || "").trim().slice(0, 500);
  if (args.reassign && !initialAuthority.operator) throw new import_graphql10.GraphQLError("Only an authorized fleet operator may cancel and reassign this request.");
  const offerSnapshot = visible.request?.id ? await context.prisma.matchOffer.findMany({ where: { requestId: visible.request.id, status: { in: ["offered", "accepted"] } }, select: { id: true, driverId: true } }) : [];
  const lockedDriverIds = new Set([visible.driver?.id, ...offerSnapshot.map((offer) => offer.driverId)].filter((id) => Boolean(id)));
  const lockedOfferIds = new Set([visible.acceptedOffer?.id, ...offerSnapshot.map((offer) => offer.id)].filter((id) => Boolean(id)));
  const expectedOfferLockSet = offerSnapshot.map((offer) => JSON.stringify([offer.id, offer.driverId])).sort();
  const lockKeys = [
    ...Array.from(lockedDriverIds, (id) => `driver:${id}`),
    ...Array.from(lockedOfferIds, (id) => `offer:${id}`),
    `request:${visible.request?.id || ""}`,
    `trip:${visible.id}`,
    `vehicle:${visible.vehicle?.id || ""}`
  ].sort();
  return context.prisma.$transaction(async (tx) => {
    for (const key of lockKeys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text IS NOT NULL`;
    await fenceHumanAuthority(tx, context.session, header.fleetId);
    const authority = await authorizedTripHeader(tx, context.session, visible.id, "participant");
    if (!authority) throw new import_graphql10.GraphQLError("Trip not found.");
    if (!sameTripAuthority(authority.header, header)) throw new import_graphql10.GraphQLError("Trip assignment changed concurrently; reload before retrying.");
    if (!authority.bound) throw new import_graphql10.GraphQLError("Trip binding is unavailable; reconcile the retained trip.");
    const current = await tx.trip.findFirst({ where: tripAuthorityWhere(authority.header), include: { driver: { select: { userId: true, status: true, fleetId: true } }, request: true, acceptedOffer: true } });
    if (!current) throw new import_graphql10.GraphQLError("Trip not found.");
    const actorType = authority.assignedDriver ? "driver" : authority.rider ? "rider" : "operator";
    if (args.reassign && (!authority.operator || actorType !== "operator")) throw new import_graphql10.GraphQLError("Only an authorized fleet operator may cancel and reassign this request.");
    const commandBinding = { version: 2, purpose: "trip_cancellation", actorType, ...authority.header, reviewed: { updatedAt: reviewedIso(args.expectedUpdatedAt), feeMinor: args.expectedFeeMinor, currencyCode: args.expectedCurrencyCode } };
    const replay = await tx.tripEvent.findUnique({ where: { idempotencyKey: args.idempotencyKey } });
    if (replay) {
      const metadata = replay.metadata || {};
      if (replay.tripId !== current.id || replay.actorUserId !== actorId || replay.actorType !== actorType || replay.eventType !== (args.reassign ? "trip.cancelled_for_reassignment" : "trip.cancelled") || metadata.reasonCode !== reasonCode || metadata.reason !== reason || metadata.reassign !== Boolean(args.reassign) || !(0, import_node_util5.isDeepStrictEqual)(metadata.commandBinding, commandBinding)) throw new import_graphql10.GraphQLError("Idempotency key belongs to another cancellation command.");
      const prior = metadata.cancellationId ? await tx.cancellation.findUnique({ where: { id: String(metadata.cancellationId) } }) : null;
      if (!prior) throw new import_graphql10.GraphQLError("Cancellation receipt is unavailable; reconciliation is required.");
      return prior;
    }
    if (!["driver_assigned", "driver_en_route", "driver_arrived"].includes(current.status || "") || !current.requestId || !current.acceptedOfferId) throw new import_graphql10.GraphQLError("Trip can no longer be cancelled or reassigned.");
    const cancellationEconomics = requireAcceptedQuoteFee(current.bookingSnapshot, current.request?.quoteSnapshot, "cancellationFeeMinor");
    if (!sameReviewedVersion(current.updatedAt, args.expectedUpdatedAt) || cancellationEconomics.feeMinor !== args.expectedFeeMinor || cancellationEconomics.currencyCode !== args.expectedCurrencyCode) throw new import_graphql10.GraphQLError("Cancellation review changed. Reconciliation is required before another command.");
    const releaseOffers = await tx.matchOffer.findMany({ where: { requestId: current.requestId, status: { in: ["offered", "accepted"] } }, select: { id: true, driverId: true } });
    const actualOfferLockSet = releaseOffers.map((offer) => JSON.stringify([offer.id, offer.driverId])).sort();
    if (actualOfferLockSet.length !== expectedOfferLockSet.length || actualOfferLockSet.some((key, index) => key !== expectedOfferLockSet[index])) throw new import_graphql10.GraphQLError("Affected offers changed concurrently; reload before retrying.");
    if (releaseOffers.some((offer) => !lockedOfferIds.has(offer.id) || Boolean(offer.driverId && !lockedDriverIds.has(offer.driverId)))) throw new import_graphql10.GraphQLError("Affected driver or offer lock set changed; reload before retrying.");
    const tripUpdate = await tx.trip.updateMany({ where: { id: current.id, requestId: current.requestId, acceptedOfferId: current.acceptedOfferId, status: { in: ["driver_assigned", "driver_en_route", "driver_arrived"] } }, data: { status: "cancelled", cancelledAt: /* @__PURE__ */ new Date(), managementTokenRevokedAt: /* @__PURE__ */ new Date() } });
    if (tripUpdate.count !== 1) throw new import_graphql10.GraphQLError("Trip assignment changed concurrently; reload before retrying.");
    const offerUpdate = await tx.matchOffer.updateMany({ where: { requestId: current.requestId, status: { in: ["offered", "accepted"] } }, data: { status: "withdrawn", respondedAt: /* @__PURE__ */ new Date(), reservationReleasedAt: /* @__PURE__ */ new Date() } });
    if (offerUpdate.count < 1) throw new import_graphql10.GraphQLError("Accepted offer could not be invalidated; cancellation was rolled back.");
    await tx.payment.updateMany({ where: { tripId: current.id, purpose: "fare", status: "pending" }, data: { status: "cancelled" } });
    const requestUpdate = await tx.rideRequest.updateMany({ where: { id: current.requestId, status: "matched" }, data: { status: args.reassign ? "matching" : "cancelled" } });
    if (requestUpdate.count !== 1) throw new import_graphql10.GraphQLError("Ride request changed concurrently; cancellation was rolled back.");
    const cancellation = await tx.cancellation.create({ data: { tripId: current.id, actorType, reasonCode, reason, policySnapshot: { assignmentGeneration: current.acceptedOfferId, acceptedAssignment: current.bookingSnapshot, cancellationPolicy: current.bookingSnapshot?.cancellationPolicy || {} }, feeMinor: cancellationEconomics.feeMinor, currencyCode: cancellationEconomics.currencyCode, refundRequired: "manual_review" } });
    await tx.tripEvent.create({ data: { tripId: current.id, eventType: args.reassign ? "trip.cancelled_for_reassignment" : "trip.cancelled", fromStatus: current.status || "", toStatus: "cancelled", actorType, actorUserId: actorId, idempotencyKey: args.idempotencyKey, occurredAt: /* @__PURE__ */ new Date(), metadata: { commandBinding, reasonCode, reason, feeMinor: cancellationEconomics.feeMinor, reassign: Boolean(args.reassign), cancellationId: cancellation.id, invalidatedOfferCount: offerUpdate.count, disclosure: "No refund or notification is initiated by this command." } } });
    const refreshDriverIds = new Set([current.driverId, ...releaseOffers.map((offer) => offer.driverId)].filter((id) => Boolean(id)));
    if ([...refreshDriverIds].some((id) => !lockedDriverIds.has(id))) throw new import_graphql10.GraphQLError("Affected driver lock set changed; reload before retrying.");
    for (const driverId of [...refreshDriverIds].sort()) await refreshDriverPresentDispatchStatus(tx, driverId);
    return cancellation;
  }, { isolationLevel: "Serializable" });
}
async function recordTripLocation(_root, args, context) {
  if (!humanSessionId(context.session)) throw new import_graphql10.GraphQLError("Trip not found.");
  return context.transaction(async (transactionContext) => {
    const trip = await loadAuthorizedTrip(transactionContext, args, "operations", "driverOrOperator");
    if (!["driver_en_route", "driver_arrived", "in_progress"].includes(trip.status || "")) throw new import_graphql10.GraphQLError("Location is not accepted for this trip state.");
    const fleetOperator = await canAccessFleet(transactionContext, context.session, trip.fleet?.id, "operations");
    if (context.session?.itemId !== trip.driver?.user?.id && !fleetOperator) throw new import_graphql10.GraphQLError("Only the assigned driver or authorized fleet operator may record location.");
    const fleet = await transactionContext.prisma.fleet.findUnique({ where: { id: trip.fleet.id }, select: { preciseLocationRetentionDays: true } });
    const days = Number(fleet?.preciseLocationRetentionDays);
    if (!Number.isSafeInteger(days) || days < 1 || days > 3650) throw new import_graphql10.GraphQLError("Location retention policy is unavailable.");
    if (args.encryptedCoordinateRef) throw new import_graphql10.GraphQLError("Precise location storage is unavailable until reference ownership can be verified.");
    const recordedAt = new Date(args.recordedAt || Date.now());
    if (!Number.isFinite(recordedAt.getTime()) || recordedAt.getTime() > Date.now()) throw new import_graphql10.GraphQLError("Location observation time is invalid.");
    const coarseGeohash = String(args.coarseGeohash || "");
    if (!/^[0123456789bcdefghjkmnpqrstuvwxyz]{0,7}$/.test(coarseGeohash)) throw new import_graphql10.GraphQLError("Coarse location is invalid.");
    const observation = args.providerEvidence ?? {};
    if (!observation || typeof observation !== "object" || Array.isArray(observation) || Object.keys(observation).some((key) => !["observationId", "clientVersion"].includes(key)) || Object.values(observation).some((value) => typeof value !== "string" || value.length > 100 || !/^[a-zA-Z0-9_.:-]*$/.test(value))) throw new import_graphql10.GraphQLError("Location observation metadata is invalid.");
    const accuracyMeters = args.accuracyMeters ?? 0;
    if (!Number.isSafeInteger(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 1e4) throw new import_graphql10.GraphQLError("Location accuracy is invalid.");
    return transactionContext.sudo().query.LocationEvent.createOne({ data: { trip: { connect: { id: trip.id } }, actorType: context.session?.itemId === trip.driver?.user?.id ? "driver" : "operator", recordedAt, coarseGeohash, encryptedCoordinateRef: "", accuracyMeters, providerEvidence: { ...observation, source: "client_observation", authoritative: false, actorUserId: context.session.itemId }, expiresAt: new Date(recordedAt.getTime() + days * 24 * 60 * 6e4) }, query: "id recordedAt coarseGeohash expiresAt" });
  });
}
async function keyedTripSubmission(context, args, purpose, capability, body, create) {
  const key = requireCommandKey(args.idempotencyKey);
  const bodyHash = commandBodyHash(body);
  return context.transaction(async (tx) => {
    await fenceHumanAuthority(tx.prisma, context.session);
    for (const lock of [`command:${key}`, `trip:${args.tripId}`].sort()) await tx.prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text IS NOT NULL`;
    const trip = await loadAuthorizedTrip(tx, args, capability, "participant");
    const actorId = context.session.itemId;
    const actorType = actorId === trip.driver?.user?.id ? "driver" : actorId === trip.rider?.id ? "rider" : "operator";
    const commandBinding = { version: 1, purpose, actorId, actorType, bodyHash, tripId: trip.id, fleetId: trip.fleetId, requestId: trip.requestId, acceptedOfferId: trip.acceptedOfferId, driverId: trip.driverId, vehicleId: trip.vehicleId };
    const prior = await tx.prisma.tripEvent.findUnique({ where: { idempotencyKey: key } });
    if (prior) {
      if (prior.tripId !== trip.id || prior.actorUserId !== actorId || prior.eventType !== purpose || !(0, import_node_util5.isDeepStrictEqual)(prior.metadata?.commandBinding, commandBinding) || !prior.metadata?.result?.id) throw new import_graphql10.GraphQLError("Command key belongs to another submission or assignment.");
      return prior.metadata.result;
    }
    const result = await create(tx, trip, actorType);
    if (!result || typeof result.id !== "string" || !result.id) throw new import_graphql10.GraphQLError("Submission receipt is unavailable.");
    await tx.prisma.tripEvent.create({ data: { tripId: trip.id, eventType: purpose, actorType, actorUserId: actorId, idempotencyKey: key, occurredAt: /* @__PURE__ */ new Date(), metadata: { commandBinding, result } } });
    return result;
  }, { isolationLevel: "Serializable" });
}
async function sendTripMessage(_root, args, context) {
  const body = String(args.body || "").trim();
  if (!body || body.length > 2e3) throw new import_graphql10.GraphQLError("Message must be between 1 and 2000 characters.");
  return keyedTripSubmission(context, args, "trip.message_submitted", "operations", { body }, async (tx, trip, actorType) => {
    const sudo = tx.sudo();
    let conversation = trip.conversation;
    if (!conversation) conversation = await sudo.query.Conversation.createOne({ data: { trip: { connect: { id: trip.id } }, status: "open" }, query: "id status" });
    if (conversation.status !== "open") throw new import_graphql10.GraphQLError("Conversation is not open.");
    return sudo.query.Message.createOne({ data: { conversation: { connect: { id: conversation.id } }, senderType: actorType, sender: { connect: { id: context.session.itemId } }, body, status: "queued", metadata: { directContactShared: false } }, query: "id senderType status createdAt" });
  });
}
async function reportSafetyIncident(_root, args, context) {
  const severity = args.severity || "medium";
  if (!["low", "medium", "high", "critical"].includes(severity)) throw new import_graphql10.GraphQLError("Incident severity is invalid.");
  const category = String(args.category || "other").trim();
  const summary = String(args.summary || "").trim();
  if (!summary || summary.length > 500 || category.length > 80) throw new import_graphql10.GraphQLError("Incident category or summary is invalid.");
  const restrictedDetails = args.restrictedDetails || {};
  const evidenceRefs = args.evidenceRefs || [];
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length > 50 || evidenceRefs.some((ref) => typeof ref !== "string" || ref.length > 1e3)) throw new import_graphql10.GraphQLError("Incident evidence references are invalid.");
  return keyedTripSubmission(context, args, "trip.incident_submitted", "safety", { severity, category, summary, restrictedDetails, evidenceRefs }, (tx, trip) => tx.sudo().query.SafetyIncident.createOne({ data: { trip: { connect: { id: trip.id } }, caseNumber: `SAFE-${(0, import_node_crypto9.randomUUID)().slice(0, 8).toUpperCase()}`, severity, status: "open", category, summary, restrictedDetails, evidenceRefs, reportedBy: { connect: { id: context.session.itemId } }, reportedAt: /* @__PURE__ */ new Date() }, query: "id caseNumber severity status reportedAt" }));
}
async function openSupportCase(_root, args, context) {
  const category = String(args.category || "trip").trim();
  const subject = String(args.subject || "").trim();
  const description = String(args.description || "").trim();
  if (!subject || subject.length > 160 || !description || description.length > 2e3 || category.length > 80) throw new import_graphql10.GraphQLError("Support subject or description is invalid.");
  return keyedTripSubmission(context, args, "trip.support_submitted", "safety", { category, subject, description }, (tx, trip) => tx.sudo().query.SupportCase.createOne({ data: { trip: { connect: { id: trip.id } }, caseNumber: `HELP-${(0, import_node_crypto9.randomUUID)().slice(0, 8).toUpperCase()}`, status: "open", category, subject, description, priority: "normal", requester: { connect: { id: context.session.itemId } } }, query: "id caseNumber status createdAt" }));
}
async function submitTripReview(_root, args, context) {
  const trip = await loadAuthorizedTrip(context, args, "operations", "reviewParticipant");
  if (trip.status !== "completed") throw new import_graphql10.GraphQLError("Only completed trips can be reviewed.");
  const actorId = context.session?.itemId || null;
  const isDriver = Boolean(actorId && actorId === trip.driver?.user?.id);
  const isRider = Boolean(actorId && actorId === trip.rider?.id);
  if (!isDriver && !isRider) throw new import_graphql10.GraphQLError("Only the assigned rider or driver may submit a review.");
  const rating = Number(args.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new import_graphql10.GraphQLError("Rating must be an integer from 1 to 5.");
  const idempotencyKey = String(args.idempotencyKey || "").trim();
  if (idempotencyKey.length < 12 || idempotencyKey.length > 200) throw new import_graphql10.GraphQLError("A stable idempotency key of 12\u2013200 characters is required.");
  const direction = isDriver ? "driver_to_rider" : "rider_to_driver";
  const body = String(args.body || "").trim().slice(0, 2e3);
  const prisma = context.prisma;
  return prisma.$transaction(async (tx) => {
    const lockKey = `review:${trip.id}:${direction}:${actorId || "receipt-holder"}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text IS NOT NULL`;
    const authority = await authorizedTripHeader(tx, context.session, trip.id, "reviewParticipant");
    if (!authority?.bound || !sameTripAuthority(authority.header, trip)) throw new import_graphql10.GraphQLError("Trip review authority or assignment changed; reconcile before retrying.");
    const current = await tx.trip.findFirst({ where: tripAuthorityWhere(authority.header), select: { status: true } });
    if (current?.status !== "completed") throw new import_graphql10.GraphQLError("Only completed trips can be reviewed.");
    const replay = await tx.tripEvent.findUnique({ where: { idempotencyKey } });
    if (replay) {
      const metadata = replay.metadata || {};
      if (replay.tripId !== trip.id || replay.actorUserId !== actorId || replay.eventType !== "trip.review_submitted" || metadata.direction !== direction || metadata.rating !== rating || metadata.bodyHash !== createReviewBodyHash(body)) throw new import_graphql10.GraphQLError("Idempotency key belongs to another review command.");
      const replayReview = metadata.reviewId ? await tx.review.findUnique({ where: { id: String(metadata.reviewId) } }) : null;
      if (!replayReview) throw new import_graphql10.GraphQLError("Review receipt is unavailable; reconciliation is required.");
      return replayReview;
    }
    const existing = await tx.review.findFirst({ where: { tripId: trip.id, authorId: actorId, direction } });
    if (existing) {
      if (existing.rating === rating && existing.body === body) return existing;
      throw new import_graphql10.GraphQLError("A review has already been submitted for this trip and direction.");
    }
    const review = await tx.review.create({ data: { tripId: trip.id, authorId: actorId, direction, rating, body, status: "pending", submittedAt: /* @__PURE__ */ new Date() } });
    await tx.tripEvent.create({ data: { tripId: trip.id, eventType: "trip.review_submitted", fromStatus: "completed", toStatus: "completed", actorType: isDriver ? "driver" : "rider", actorUserId: actorId, idempotencyKey, occurredAt: /* @__PURE__ */ new Date(), metadata: { reviewId: review.id, direction, rating, bodyHash: createReviewBodyHash(body) } } });
    return review;
  }, { isolationLevel: "Serializable" });
}

// features/keystone/mutations/cardPayments.ts
var import_graphql11 = require("graphql");
var import_node_crypto10 = require("node:crypto");
init_access();
init_stripe();
var STRIPE_CODE2 = "pp_stripe";
var PAYABLE = COLLECTABLE_FARE_TRIP_STATUSES;
var ACTIVE2 = ["pending", "authorized", "captured", "partially_refunded", "refunded"];
async function stripeProvider(context) {
  const provider = await context.sudo().query.PaymentProvider.findOne({ where: { code: STRIPE_CODE2 }, query: "id isInstalled createPaymentFunction" });
  return provider?.isInstalled === "yes" && provider.createPaymentFunction === "stripe" && stripeSecretKey() ? provider : null;
}
async function riderTrip(context, tripId) {
  if (!humanSessionId(context.session)) throw new import_graphql11.GraphQLError("Sign in to pay for this ride.");
  const authority = await authorizedTripHeader(context.prisma, context.session, tripId, "riderOrOperator", "finance");
  if (!authority) throw new import_graphql11.GraphQLError("Trip not found.");
  const trip = await context.prisma.trip.findUnique({ where: { id: tripId }, select: { id: true, status: true, confirmationCode: true, bookingSnapshot: true, riderId: true } });
  if (!trip) throw new import_graphql11.GraphQLError("Trip not found.");
  return { trip, bound: authority.bound };
}
function activePayment(context, tripId) {
  return context.prisma.payment.findFirst({
    where: { tripId, purpose: "fare", status: { in: ACTIVE2 } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, amountMinor: true, currencyCode: true, providerReference: true, providerEvidence: true, tripId: true, provider: { select: { code: true } } }
  });
}
function money3(trip) {
  try {
    return moneySnapshot(trip.bookingSnapshot);
  } catch {
    return null;
  }
}
async function capture(context, payment, session2) {
  const intent = typeof session2.payment_intent === "string" ? { id: session2.payment_intent, latest_charge: null } : session2.payment_intent;
  const charge = intent?.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const card = charge?.payment_method_details?.card;
  const late = await context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${payment.id}`}, 0))::text IS NOT NULL`;
    const updated = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["pending", "authorized"] } }, data: { status: "captured", capturedAt: /* @__PURE__ */ new Date() } });
    if (updated.count !== 1) return (await tx.payment.findUnique({ where: { id: payment.id }, select: { status: true } }))?.status === "cancelled";
    await tx.paymentObservation.create({ data: { paymentId: payment.id, observationKey: (0, import_node_crypto10.randomUUID)(), details: {
      phase: "captured",
      source: "stripe_checkout",
      checkoutSessionId: session2.id,
      paymentIntentId: intent?.id ?? null,
      chargeId: charge?.id ?? null,
      card: card ? { brand: card.brand ?? null, last4: card.last4 ?? null } : null,
      amountMinor: payment.amountMinor,
      currencyCode: payment.currencyCode,
      observedAt: (/* @__PURE__ */ new Date()).toISOString()
    } } });
    await tx.ledgerEntry.create({ data: { tripId: payment.tripId, paymentId: payment.id, entryKey: `payment:${payment.id}:captured`, kind: "rider_charge", account: "rider_receivable", direction: "credit", amountMinor: payment.amountMinor, currencyCode: payment.currencyCode, memo: "Paid by card online", metadata: { checkoutSessionId: session2.id, paymentIntentId: intent?.id ?? null } } });
    return false;
  }, { isolationLevel: "Serializable" });
  if (late && intent?.id) {
    const refund = await refundLateCheckout({ paymentIntentId: intent.id, paymentId: payment.id });
    await context.prisma.paymentObservation.create({ data: { paymentId: payment.id, observationKey: `late-checkout-refund:${payment.id}`, details: {
      phase: "late_payment_refunded",
      source: "stripe_checkout",
      checkoutSessionId: session2.id,
      paymentIntentId: intent.id,
      refundId: refund.id,
      refundStatus: refund.status,
      amountMinor: payment.amountMinor,
      currencyCode: payment.currencyCode,
      observedAt: (/* @__PURE__ */ new Date()).toISOString()
    } } }).catch(() => void 0);
  }
}
async function cancelAttempt(context, payment, reason) {
  await context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${payment.id}`}, 0))::text IS NOT NULL`;
    const updated = await tx.payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status: "cancelled" } });
    if (updated.count === 1) await tx.paymentObservation.create({ data: { paymentId: payment.id, observationKey: (0, import_node_crypto10.randomUUID)(), details: { phase: "cancelled", source: "stripe_checkout", reason, observedAt: (/* @__PURE__ */ new Date()).toISOString() } } });
  }, { isolationLevel: "Serializable" });
}
async function settle(context, trip, payment) {
  const session2 = await retrieveCheckoutSession(String(payment.providerReference || ""));
  if (session2.client_reference_id !== trip.id || session2.metadata?.tripId !== trip.id) throw new import_graphql11.GraphQLError("This payment doesn\u2019t belong to this ride.");
  if (session2.payment_status === "paid") {
    if (session2.amount_total !== payment.amountMinor || session2.currency?.toUpperCase() !== payment.currencyCode) throw new import_graphql11.GraphQLError("The paid amount doesn\u2019t match this ride. Contact the fleet.");
    await capture(context, payment, session2);
    return { status: "captured", session: session2 };
  }
  if (session2.status === "expired") {
    await cancelAttempt(context, payment, "checkout_expired");
    return { status: "cancelled", session: session2 };
  }
  return { status: "pending", session: session2 };
}
async function tripCardPayment(_root, args, context) {
  const { trip, bound } = await riderTrip(context, args.tripId);
  const fare = money3(trip);
  const enabled = Boolean(await stripeProvider(context));
  const payment = await activePayment(context, trip.id);
  const saved = await savedCardFare(context.prisma, trip.id, trip.riderId);
  const autoPays = Boolean(saved.savedCard) && !saved.failure && trip.status !== "completed";
  const settlingOnCard = payment?.status === "pending" && payment.providerEvidence?.source === "saved_card";
  return {
    savedCard: saved.savedCard,
    failure: saved.failure,
    enabled,
    payable: enabled && bound && !autoPays && !settlingOnCard && PAYABLE.includes(trip.status || "") && Boolean(fare) && (!payment || payment.provider?.code === STRIPE_CODE2 && payment.status === "pending"),
    status: payment?.status ?? null,
    amountMinor: payment?.amountMinor ?? fare?.amount ?? null,
    currencyCode: payment?.currencyCode ?? fare?.currency ?? null,
    url: null
  };
}
async function startTripCardPayment(_root, args, context) {
  const { trip } = await riderTrip(context, args.tripId);
  if (!await stripeProvider(context)) throw new import_graphql11.GraphQLError("Card payment isn\u2019t available for this ride.");
  const existing = await activePayment(context, trip.id);
  if (existing && existing.status !== "pending") throw new import_graphql11.GraphQLError("This ride is already paid.");
  if (existing && existing.provider?.code !== STRIPE_CODE2) throw new import_graphql11.GraphQLError("The fleet is collecting this fare directly.");
  if (existing && existing.providerEvidence?.source === "saved_card") throw new import_graphql11.GraphQLError("Your saved card is being charged for this ride.");
  if (existing) {
    const settled = await settle(context, trip, existing);
    if (settled.status === "captured") return { enabled: true, payable: false, status: "captured", amountMinor: existing.amountMinor, currencyCode: existing.currencyCode, url: null };
    if (settled.status === "pending" && settled.session.url) return { enabled: true, payable: true, status: "pending", amountMinor: existing.amountMinor, currencyCode: existing.currencyCode, url: settled.session.url };
    if (settled.status === "pending") await cancelAttempt(context, existing, "checkout_unavailable");
  }
  const payment = await initiateTripPayment(null, { tripId: trip.id, providerCode: STRIPE_CODE2, idempotencyKey: `card:${trip.id}:${(0, import_node_crypto10.randomUUID)()}` }, context);
  const session2 = await retrieveCheckoutSession(String(payment.providerReference || ""));
  if (!session2.url) throw new import_graphql11.GraphQLError("Card payment couldn\u2019t start. Try again in a moment.");
  return { enabled: true, payable: true, status: "pending", amountMinor: payment.amountMinor, currencyCode: payment.currencyCode, url: session2.url };
}
async function confirmTripCardPayment(_root, args, context) {
  const { trip } = await riderTrip(context, args.tripId);
  const payment = await activePayment(context, trip.id);
  const view = (status) => ({ enabled: true, payable: status === "pending", status, amountMinor: payment?.amountMinor ?? null, currencyCode: payment?.currencyCode ?? null, url: null });
  if (!payment || payment.provider?.code !== STRIPE_CODE2 || payment.status !== "pending" || payment.providerEvidence?.source === "saved_card") return view(payment?.status ?? null);
  if (!stripeSecretKey()) throw new import_graphql11.GraphQLError("Card payment isn\u2019t available for this ride.");
  const settled = await settle(context, trip, payment);
  return view(settled.status);
}

// features/keystone/mutations/accountViews.ts
async function myDriverWorkspace(_root, args, context) {
  return context.prisma.$transaction(async (tx) => {
    const actorId = await currentRiderId(tx, context.session);
    if (!actorId) throw new Error("A current driver account session is required.");
    const driver = await tx.driverProfile.findFirst({ where: { userId: actorId }, select: { id: true, userId: true, fleetId: true, publicName: true, status: true, dispatchStatus: true, fleet: { select: { operationsMode: true } } } });
    const readiness = rideReadiness(driver?.fleet?.operationsMode);
    const empty = { actorId, driver: driver ? { id: driver.id, publicName: driver.publicName, status: driver.status, dispatchStatus: driver.dispatchStatus } : null, offers: [], trips: [], offersNextCursor: null, tripsNextCursor: null, actionsEnabled: false, actionsBlockedReason: "An active fleet-linked driver profile is required." };
    if (!driver?.fleetId || driver.status !== "active") return empty;
    const scope = JSON.stringify([actorId, driver.fleetId, driver.id]);
    const offerBoundary = decodeKeyset(args?.offersCursor, "driver_offers", scope);
    const tripBoundary = decodeKeyset(args?.tripsCursor, "driver_trips", scope);
    const [offerRows, tripRows] = await Promise.all([
      tx.matchOffer.findMany({
        where: {
          driverId: driver.id,
          driver: { is: { userId: actorId, fleetId: driver.fleetId, status: "active" } },
          request: { is: { fleetId: driver.fleetId } },
          vehicle: { is: { fleetId: driver.fleetId } },
          status: "offered",
          expiresAt: { gt: /* @__PURE__ */ new Date() },
          ...offerBoundary ? { OR: offerBoundary.time ? [{ offeredAt: { lt: new Date(offerBoundary.time) } }, { offeredAt: new Date(offerBoundary.time), id: { lt: offerBoundary.id } }, { offeredAt: null }] : [{ offeredAt: null, id: { lt: offerBoundary.id } }] } : {}
        },
        orderBy: [{ offeredAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        take: 26,
        select: { id: true, status: true, offeredAt: true, expiresAt: true, request: { select: { id: true, requestNumber: true, requestedFor: true, passengerCount: true, pickupLabel: true, dropoffLabel: true } }, vehicle: { select: { id: true, label: true, make: true, model: true, color: true, plateMasked: true } } }
      }),
      tx.trip.findMany({
        where: {
          driverId: driver.id,
          fleetId: driver.fleetId,
          driver: { is: { userId: actorId, fleetId: driver.fleetId, status: "active" } },
          vehicle: { is: { fleetId: driver.fleetId } },
          status: { in: ["driver_assigned", "driver_en_route", "driver_arrived", "in_progress"] },
          ...tripBoundary ? { OR: tripBoundary.time ? [{ scheduledFor: { gt: new Date(tripBoundary.time) } }, { scheduledFor: new Date(tripBoundary.time), id: { gt: tripBoundary.id } }] : [{ scheduledFor: null, id: { gt: tripBoundary.id } }, { scheduledFor: { not: null } }] } : {}
        },
        orderBy: [{ scheduledFor: { sort: "asc", nulls: "first" } }, { id: "asc" }],
        take: 26,
        select: { id: true, acceptedOfferId: true, confirmationCode: true, status: true, scheduledFor: true, pickupLabel: true, dropoffLabel: true, vehicle: { select: { id: true, label: true, plateMasked: true } } }
      })
    ]);
    const next = (rows, purpose, field) => rows.length > 25 ? encodeKeyset(purpose, scope, { id: rows[24].id, time: rows[24][field]?.toISOString() || null }) : null;
    return { ...empty, offers: offerRows.slice(0, 25), trips: tripRows.slice(0, 25), offersNextCursor: next(offerRows, "driver_offers", "offeredAt"), tripsNextCursor: next(tripRows, "driver_trips", "scheduledFor"), actionsEnabled: readiness.bookingEnabled, actionsBlockedReason: readiness.bookingEnabled ? null : OPERATIONS_OFF_MESSAGE };
  }, { isolationLevel: "RepeatableRead" });
}
async function myRideshareTrips(_root, _args, context) {
  const history = await myRideshareRequests(_root, {}, context);
  return history.items.filter((item) => item.trip).map((item) => ({ ...item.trip, createdAt: item.createdAt }));
}

// features/keystone/mutations/operatorHandoffs.ts
init_access();
async function operatorTripHandoff(_root, args, context) {
  if (!humanSessionId(context.session) || typeof args.tripId !== "string" || !args.tripId || args.tripId.length > 200) return null;
  return context.prisma.$transaction(async (tx) => {
    await fenceHumanAuthority(tx, context.session);
    const authority = await authorizedTripHeader(tx, context.session, args.tripId, "operator");
    if (!authority) return null;
    const scope = JSON.stringify([authority.actorId, authority.header.fleetId, authority.header.id, authority.header.acceptedOfferId]);
    const boundary = decodeKeyset(args.cursor, "operator_trip_events", scope);
    if (boundary && boundary.time === null) throw new Error("Invalid event page cursor.");
    if (!authority.bound) {
      const state = await tx.trip.findFirst({ where: authority.header, select: { id: true, status: true } });
      return state ? { available: false, tripId: state.id, status: state.status, requestId: null, requestNumber: null, requestStatus: null, acceptedOfferId: null, events: [], historyTruncated: false } : null;
    }
    const trip = await tx.trip.findFirst({ where: tripAuthorityWhere(authority.header), include: {
      request: { include: { quote: { include: { service: { select: { fleetId: true } } } } } },
      acceptedOffer: true,
      events: { where: boundary ? { OR: [{ occurredAt: { lt: new Date(boundary.time) } }, { occurredAt: new Date(boundary.time), id: { lt: boundary.id } }] } : {}, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 101 }
    } });
    if (!trip) return null;
    const request = trip.request;
    const available = Boolean(request && hasRequestTripBinding(request, trip));
    const history = available ? projectRiderTrip(trip) : null;
    return {
      available,
      tripId: trip.id,
      status: trip.status,
      requestId: available ? request.id : null,
      requestNumber: available ? request.requestNumber : null,
      requestStatus: available ? request.status : null,
      acceptedOfferId: available ? trip.acceptedOfferId : null,
      events: history?.events || [],
      historyTruncated: history?.historyTruncated || false,
      nextCursor: available && trip.events.length > 100 ? encodeKeyset("operator_trip_events", scope, { id: trip.events[99].id, time: trip.events[99].occurredAt.toISOString() }) : null
    };
  }, { isolationLevel: "RepeatableRead" });
}

// features/keystone/mutations/riderTripHistory.ts
async function riderTripHistory(_root, args, context) {
  if (!["events", "payments", "reviews"].includes(args.kind)) throw new Error("Unknown history kind.");
  return context.prisma.$transaction(async (tx) => {
    const header = await authorizedRequestHeader(tx, context.session, args.requestId, args.requestProof);
    if (!header) return null;
    const request = await tx.rideRequest.findFirst({ where: requestOwnerWhere(header), include: {
      quote: { select: { id: true, publicId: true, requestId: true, service: { select: { fleetId: true } } } },
      trip: { include: { acceptedOffer: true } }
    } });
    if (!request?.trip || !hasRequestTripBinding(request, request.trip)) return null;
    const trip = request.trip;
    const scope = JSON.stringify([header.riderId || "guest", header.fleetId, header.id, trip.id, trip.acceptedOfferId]);
    const purpose = `rider_trip_${args.kind}`;
    const boundary = decodeKeyset(args.cursor, purpose, scope);
    const field = args.kind === "events" ? "occurredAt" : args.kind === "payments" ? "createdAt" : "submittedAt";
    const where = { tripId: trip.id, ...args.kind === "reviews" ? { status: "published" } : {}, ...boundary ? boundary.time === null ? { [field]: null, id: { lt: boundary.id } } : { OR: [{ [field]: { lt: new Date(boundary.time) } }, { [field]: new Date(boundary.time), id: { lt: boundary.id } }, { [field]: null }] } : {} };
    const select9 = args.kind === "events" ? { id: true, eventType: true, fromStatus: true, toStatus: true, occurredAt: true } : args.kind === "payments" ? { id: true, amountMinor: true, currencyCode: true, status: true, createdAt: true } : { id: true, direction: true, rating: true, body: true, status: true, submittedAt: true };
    const model = args.kind === "events" ? tx.tripEvent : args.kind === "payments" ? tx.payment : tx.review;
    const limit = args.kind === "events" ? 100 : 20;
    const rows = await model.findMany({ where, orderBy: [{ [field]: { sort: "desc", nulls: "last" } }, { id: "desc" }], take: limit + 1, select: select9 });
    const items = rows.slice(0, limit);
    const last2 = items.at(-1);
    return { requestId: header.id, tripId: trip.id, kind: args.kind, items, nextCursor: rows.length > limit ? encodeKeyset(purpose, scope, { id: last2.id, time: last2[field]?.toISOString() || null }) : null };
  }, { isolationLevel: "RepeatableRead" });
}

// features/keystone/mutations/dispatchCandidates.ts
init_access();
async function dispatchCandidatePage(_root, args, context) {
  const actorId = humanSessionId(context.session);
  if (!actorId) return null;
  const query = args.query?.trim() || "";
  if (query.length > 100) throw new Error("Candidate search is too long.");
  return context.prisma.$transaction(async (tx) => {
    const header = await tx.rideRequest.findUnique({ where: { id: args.requestId }, select: { id: true, fleetId: true } });
    if (!header?.fleetId) return null;
    await fenceHumanAuthority(tx, context.session, header.fleetId);
    if (!await canAccessFleet({ prisma: tx }, context.session, header.fleetId, "operations")) return null;
    const request = await tx.rideRequest.findFirst({ where: header, select: { id: true, status: true, requestedFor: true, passengerCount: true, accessibilityNeeds: true, quote: { select: { service: { select: { status: true, fleetId: true, passengerCapacity: true, wheelchairAccessible: true } } } } } });
    if (!request) return null;
    const now = /* @__PURE__ */ new Date();
    const service = request.quote?.service;
    const fleet = await tx.fleet.findUnique({ where: { id: header.fleetId }, select: { status: true } });
    const scope = JSON.stringify([actorId, header.fleetId, header.id, query]);
    const boundary = decodeKeyset(args.cursor, "dispatch_pairs", scope);
    let after = null;
    if (boundary) {
      try {
        after = JSON.parse(boundary.id);
      } catch {
        throw new Error("Invalid candidate cursor.");
      }
      if (boundary.time !== null || !Array.isArray(after) || after.length !== 2 || typeof after[0] !== "string" || !after[0] || after[1] !== null && (typeof after[1] !== "string" || !after[1])) throw new Error("Invalid candidate cursor.");
    }
    const base = { requestId: header.id, actorId, evaluatedAt: now.toISOString(), items: [], nextCursor: null };
    const scheduled = isFutureScheduledRequest(request.requestedFor, now);
    if (!["requested", "matching"].includes(request.status) || fleet?.status !== "active" || !service || service.status !== "active" || service.fleetId !== header.fleetId || Boolean(request.requestedFor) && !scheduled && !isLateScheduledRequest(request.requestedFor, now)) return { ...base, blockedReason: "The request or its service is unavailable for a new offer." };
    const at = scheduled ? new Date(request.requestedFor) : now;
    const needs = request.accessibilityNeeds && typeof request.accessibilityNeeds === "object" ? request.accessibilityNeeds : {};
    if (!Number.isSafeInteger(request.passengerCount) || request.passengerCount < 1 || request.passengerCount > service.passengerCapacity) return { ...base, blockedReason: "Passenger capacity evidence is unavailable." };
    const drivers = await tx.driverProfile.findMany({ where: {
      fleetId: header.fleetId,
      status: "active",
      dispatchStatus: { in: scheduled ? ["available", "offered", "assigned", "on_trip"] : ["available"] },
      ...scheduled ? { acceptsScheduled: true } : {},
      ...query ? { OR: [{ id: query }, { publicName: { contains: query, mode: "insensitive" } }] } : {},
      ...after ? { id: { [after[1] === null ? "gt" : "gte"]: after[0] } } : {}
    }, orderBy: { id: "asc" }, take: 11, select: { id: true, publicName: true } });
    const cursor = (driverId, vehicleId) => encodeKeyset("dispatch_pairs", scope, { id: JSON.stringify([driverId, vehicleId]), time: null });
    for (const driver of drivers.slice(0, 10)) {
      if (!await loadCurrentEligibility(tx, "driver", driver.id, header.fleetId, now) || !await isCurrentlyAvailableAt(tx, driver.id, at)) {
        base.nextCursor = cursor(driver.id, null);
        continue;
      }
      const vehicles = await tx.vehicle.findMany({ where: {
        fleetId: header.fleetId,
        status: "active",
        drivers: { some: { id: driver.id, fleetId: header.fleetId } },
        capacity: { gte: request.passengerCount },
        ...needs.wheelchairAccessible === true || service.wheelchairAccessible ? { wheelchairAccessible: true } : {},
        ...after && after[0] === driver.id && after[1] ? { id: { gt: after[1] } } : {}
      }, orderBy: { id: "asc" }, take: 26, select: { id: true, label: true, capacity: true } });
      for (const vehicle of vehicles.slice(0, 25)) {
        base.nextCursor = cursor(driver.id, vehicle.id);
        if (!await loadCurrentEligibility(tx, "vehicle", vehicle.id, header.fleetId, now)) continue;
        const liveOffer = await tx.matchOffer.findFirst({ where: { requestId: request.id, OR: [{ status: "accepted" }, { status: "offered", expiresAt: { gt: now }, OR: [{ driverId: driver.id }, { vehicleId: vehicle.id }] }] }, select: { id: true } });
        if (liveOffer) continue;
        base.items.push({ driverId: driver.id, driverName: driver.publicName, vehicleId: vehicle.id, vehicleLabel: vehicle.label, capacity: vehicle.capacity });
        if (base.items.length === 20) return { ...base, blockedReason: null };
      }
      if (vehicles.length > 25) return { ...base, blockedReason: null };
      base.nextCursor = cursor(driver.id, null);
    }
    if (drivers.length <= 10) base.nextCursor = null;
    return { ...base, blockedReason: null };
  }, { isolationLevel: "RepeatableRead" });
}

// features/keystone/mutations/fleetOperations.ts
var import_node_crypto11 = require("node:crypto");
var import_graphql12 = require("graphql");
init_access();
var fail = (message) => {
  throw new import_graphql12.GraphQLError(message, { extensions: { code: "RIDESHARE_OPERATION_INVALID" } });
};
var oneOf = (value, options, label) => {
  if (!options.includes(value)) fail(`${label} must be one of: ${options.join(", ").replaceAll("_", " ")}.`);
  return value;
};
async function requireActor(context) {
  const actor = await currentHumanActor(context.prisma, context.session);
  if (!actor) fail("Sign in to continue.");
  return actor;
}
async function requireFleet(context, fleetId, capability) {
  if (typeof fleetId !== "string" || !fleetId || !await canAccessFleet(context, context.session, fleetId, capability)) fail("Not found or outside your access.");
  return fleetId;
}
var MEMBER_ROLES = ["owner", "dispatcher", "support", "finance", "viewer"];
async function addFleetMember(_root, args, context) {
  await requireActor(context);
  const fleetId = await requireFleet(context, args.fleetId, "fleetAdmin");
  const role = oneOf(args.role, MEMBER_ROLES, "Role");
  const email = String(args.email || "").trim().toLowerCase();
  if (!email || email.length > 200) fail("Email is required.");
  const user = await context.prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) fail("No account uses that email. They sign up or are added under People first.");
  const existing = await context.prisma.fleetMembership.findFirst({ where: { fleetId, userId: user.id }, select: { id: true } });
  if (existing) fail("That person is already on this fleet.");
  try {
    return await context.prisma.fleetMembership.create({ data: { fleetId, userId: user.id, role, status: "active", invitedAt: /* @__PURE__ */ new Date(), acceptedAt: /* @__PURE__ */ new Date() }, select: { id: true, role: true, status: true } });
  } catch (error) {
    if (error?.code === "P2002") fail("That person is already on this fleet.");
    throw error;
  }
}
async function updateFleetMember(_root, args, context) {
  const actor = await requireActor(context);
  const membership = await context.prisma.fleetMembership.findUnique({ where: { id: args.membershipId }, select: { id: true, fleetId: true, userId: true, role: true, status: true } });
  const fleetId = await requireFleet(context, membership?.fleetId, "fleetAdmin");
  const role = args.role ? oneOf(args.role, MEMBER_ROLES, "Role") : membership.role;
  const status = args.status ? oneOf(args.status, ["active", "suspended"], "Status") : membership.status;
  if (membership.userId === actor.id && (role !== "owner" || status !== "active")) fail("You can\u2019t remove your own owner access.");
  return context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fleet-owners:${fleetId}`}, 0))::text IS NOT NULL`;
    const live = await tx.fleetMembership.findUnique({ where: { id: membership.id }, select: { role: true, status: true } });
    if (live?.role === "owner" && live.status === "active" && (role !== "owner" || status !== "active")) {
      const owners = await tx.fleetMembership.count({ where: { fleetId, role: "owner", status: "active" } });
      if (owners <= 1) fail("A fleet needs at least one active owner.");
    }
    return tx.fleetMembership.update({ where: { id: membership.id }, data: { role, status }, select: { id: true, role: true, status: true } });
  });
}
async function addDriverTimeOff(_root, args, context) {
  await requireActor(context);
  const driver = await context.prisma.driverProfile.findUnique({ where: { id: args.driverId }, select: { id: true, fleetId: true } });
  await requireFleet(context, driver?.fleetId, "operations");
  const startsAt = new Date(args.startsAt), endsAt = new Date(args.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) fail("Choose an end after the start.");
  if (endsAt.getTime() - startsAt.getTime() > 366 * 864e5) fail("Time off can be at most a year.");
  const kind = args.kind ? oneOf(args.kind, ["blocked", "available"], "Type") : "blocked";
  return context.prisma.availabilityException.create({ data: { driverId: driver.id, startsAt, endsAt, kind, reason: String(args.reason || "").trim().slice(0, 200) }, select: { id: true } });
}
async function removeDriverTimeOff(_root, args, context) {
  await requireActor(context);
  const exception = await context.prisma.availabilityException.findUnique({ where: { id: args.exceptionId }, select: { id: true, driver: { select: { fleetId: true } } } });
  await requireFleet(context, exception?.driver?.fleetId, "operations");
  await context.prisma.availabilityException.delete({ where: { id: exception.id } });
  return { id: exception.id, removed: true };
}
async function updateSafetyIncident(_root, args, context) {
  const actor = await requireActor(context);
  const incident = await context.prisma.safetyIncident.findUnique({ where: { id: args.incidentId }, select: { id: true, status: true, trip: { select: { fleetId: true } } } });
  await requireFleet(context, incident?.trip?.fleetId, "safety");
  const data = {};
  if (args.status) {
    assertTransition("incident", incident.status || "open", args.status, "incident");
    data.status = args.status;
    if (args.status === "resolved") data.resolvedAt = /* @__PURE__ */ new Date();
  }
  if (args.assignToMe) data.assignedToId = actor.id;
  if (!Object.keys(data).length) fail("Nothing to change.");
  const guarded = await context.prisma.safetyIncident.updateMany({ where: { id: incident.id, status: incident.status }, data });
  if (guarded.count !== 1) fail("This incident changed. Reload and try again.");
  return context.prisma.safetyIncident.findUnique({ where: { id: incident.id }, select: { id: true, status: true } });
}
async function updateSupportCase(_root, args, context) {
  const actor = await requireActor(context);
  const supportCase = await context.prisma.supportCase.findUnique({ where: { id: args.caseId }, select: { id: true, status: true, trip: { select: { fleetId: true } } } });
  await requireFleet(context, supportCase?.trip?.fleetId, "safety");
  const data = {};
  if (args.status) {
    assertTransition("supportCase", supportCase.status || "open", args.status, "case");
    data.status = args.status;
    if (args.status === "resolved") data.resolvedAt = /* @__PURE__ */ new Date();
  }
  if (args.assignToMe) data.assignedToId = actor.id;
  if (!Object.keys(data).length) fail("Nothing to change.");
  const guarded = await context.prisma.supportCase.updateMany({ where: { id: supportCase.id, status: supportCase.status }, data });
  if (guarded.count !== 1) fail("This case changed. Reload and try again.");
  return context.prisma.supportCase.findUnique({ where: { id: supportCase.id }, select: { id: true, status: true } });
}
async function moderateReview(_root, args, context) {
  await requireActor(context);
  const review = await context.prisma.review.findUnique({ where: { id: args.reviewId }, select: { id: true, status: true, trip: { select: { fleetId: true } } } });
  await requireFleet(context, review?.trip?.fleetId, "safety");
  const status = oneOf(args.status, ["published", "hidden", "removed"], "Status");
  assertTransition("review", review.status || "pending", status, "review");
  const moved = await context.prisma.review.updateMany({ where: { id: review.id, status: review.status }, data: { status, moderatedAt: /* @__PURE__ */ new Date(), moderationReason: String(args.reason || "").trim().slice(0, 500) } });
  if (moved.count !== 1) fail("This review changed. Reload and try again.");
  return { id: review.id, status };
}
async function confirmManualPayment(_root, args, context) {
  const actor = await requireActor(context);
  const payment = await context.prisma.payment.findUnique({ where: { id: args.paymentId }, select: { id: true, status: true, purpose: true, amountMinor: true, currencyCode: true, tripId: true, provider: { select: { code: true } }, trip: { select: { fleetId: true, status: true } } } });
  await requireFleet(context, payment?.trip?.fleetId, "finance");
  if (payment.provider?.code !== "pp_manual") fail("Only manual payments are confirmed here.");
  if ((payment.purpose || "fare") === "fare" && !COLLECTABLE_FARE_TRIP_STATUSES.includes(payment.trip?.status || "")) fail("This ride was cancelled, so its fare can\u2019t be collected.");
  if (payment.status !== "pending" && payment.status !== "authorized") fail(`This payment is already ${String(payment.status).replaceAll("_", " ")}.`);
  const method = args.method ? oneOf(args.method, ["cash", "card_terminal", "bank_transfer", "other"], "Method") : "cash";
  return context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${payment.id}`}, 0))::text IS NOT NULL`;
    const updated = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["pending", "authorized"] } }, data: { status: "captured", capturedAt: /* @__PURE__ */ new Date() } });
    if (updated.count !== 1) fail("This payment changed. Reload and try again.");
    await tx.paymentObservation.create({ data: { paymentId: payment.id, observationKey: (0, import_node_crypto11.randomUUID)(), details: { phase: "captured", source: "operator_confirmation", method, actorId: actor.id, amountMinor: payment.amountMinor, currencyCode: payment.currencyCode, observedAt: (/* @__PURE__ */ new Date()).toISOString() } } });
    await tx.ledgerEntry.create({ data: { tripId: payment.tripId, paymentId: payment.id, entryKey: `payment:${payment.id}:captured`, kind: "rider_charge", account: "rider_receivable", direction: "credit", amountMinor: payment.amountMinor, currencyCode: payment.currencyCode, memo: `Received by ${method.replaceAll("_", " ")}`, metadata: { actorId: actor.id } } });
    return { id: payment.id, status: "captured" };
  });
}
async function confirmManualRefund(_root, args, context) {
  const actor = await requireActor(context);
  const refund = await context.prisma.refund.findUnique({ where: { id: args.refundId }, select: { id: true, status: true, amountMinor: true, currencyCode: true, payment: { select: { id: true, tripId: true, amountMinor: true, status: true, provider: { select: { code: true } }, trip: { select: { fleetId: true } } } } } });
  await requireFleet(context, refund?.payment?.trip?.fleetId, "finance");
  if (refund.payment?.provider?.code !== "pp_manual") fail("Only manual refunds are confirmed here.");
  if (!["requested", "processing"].includes(refund.status || "")) fail(`This refund is already ${String(refund.status).replaceAll("_", " ")}.`);
  return context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${refund.payment.id}`}, 0))::text IS NOT NULL`;
    const updated = await tx.refund.updateMany({ where: { id: refund.id, status: { in: ["requested", "processing"] } }, data: { status: "succeeded", processedAt: /* @__PURE__ */ new Date() } });
    if (updated.count !== 1) fail("This refund changed. Reload and try again.");
    const refunded = await tx.refund.aggregate({ where: { paymentId: refund.payment.id, status: "succeeded" }, _sum: { amountMinor: true } });
    const currentPayment = await tx.payment.findUnique({ where: { id: refund.payment.id }, select: { status: true, amountMinor: true } });
    const nextPayment = (refunded._sum.amountMinor || 0) >= (currentPayment?.amountMinor || 0) ? "refunded" : "partially_refunded";
    if ((refunded._sum.amountMinor || 0) > (currentPayment?.amountMinor || 0)) fail("Refunds would exceed what was paid. Reconcile before marking this refunded.");
    assertTransition("payment", currentPayment?.status, nextPayment, "payment");
    await tx.payment.update({ where: { id: refund.payment.id }, data: { status: nextPayment } });
    await tx.paymentObservation.create({ data: { paymentId: refund.payment.id, refundId: refund.id, observationKey: (0, import_node_crypto11.randomUUID)(), details: { phase: "refunded", source: "operator_confirmation", actorId: actor.id, amountMinor: refund.amountMinor, observedAt: (/* @__PURE__ */ new Date()).toISOString() } } });
    await tx.ledgerEntry.create({ data: { tripId: refund.payment.tripId, paymentId: refund.payment.id, entryKey: `refund:${refund.id}:succeeded`, kind: "refund", account: "rider_receivable", direction: "debit", amountMinor: refund.amountMinor, currencyCode: refund.currencyCode, memo: "Refund handed back", metadata: { actorId: actor.id } } });
    return { id: refund.id, status: "succeeded" };
  });
}

// features/keystone/mutations/fleetSetup.ts
var import_node_crypto12 = require("node:crypto");
var import_graphql13 = require("graphql");
init_access();
var fail2 = (message) => {
  throw new import_graphql13.GraphQLError(message, { extensions: { code: "RIDESHARE_SETUP_INVALID" } });
};
var text13 = (value, label, { required = false, max = 200 } = {}) => {
  const clean = typeof value === "string" ? value.trim() : "";
  if (required && !clean) fail2(`${label} is required.`);
  if (clean.length > max) fail2(`${label} must be ${max} characters or fewer.`);
  return clean;
};
var whole = (value, label, min, max, fallback) => {
  if ((value === null || value === void 0 || value === "") && fallback !== void 0) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) fail2(`${label} must be a whole number from ${min} to ${max}.`);
  return number;
};
var oneOf2 = (value, options, label, fallback) => {
  if ((value === null || value === void 0 || value === "") && fallback) return fallback;
  if (!options.includes(value)) fail2(`${label} must be one of: ${options.join(", ").replaceAll("_", " ")}.`);
  return value;
};
var dateOrNull = (value, label) => {
  if (value === null || value === void 0 || value === "") return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) fail2(`${label} is not a valid date.`);
  return date;
};
var slugify = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
async function requireActor2(context) {
  const actor = await currentHumanActor(context.prisma, context.session);
  if (!actor) fail2("Sign in to continue.");
  return actor;
}
async function requireFleet2(context, fleetId, capability) {
  if (typeof fleetId !== "string" || !fleetId || !await canAccessFleet(context, context.session, fleetId, capability)) fail2("Fleet not found or outside your access.");
  return fleetId;
}
var DRIVER_DOCUMENTS = ["driver_license", "insurance"];
var VEHICLE_DOCUMENTS = ["vehicle_registration", "inspection"];
var DOCUMENT_KINDS = ["driver_license", "vehicle_registration", "insurance", "inspection", "background_check", "business_license", "other"];
function missingDocuments(documents, required, now = /* @__PURE__ */ new Date()) {
  return required.filter((kind) => !documents.some((document) => document.kind === kind && document.status === "accepted_evidence" && (!document.expiresAt || new Date(document.expiresAt).getTime() > now.getTime())));
}
async function eligibilityPolicy(tx, fleetId, kind) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${fleetId}:${kind}`}, 0))::text IS NOT NULL`;
  const policies = await tx.policy.findMany({ where: { fleetId, kind, status: "active" }, orderBy: { id: "asc" }, take: 2, select: { id: true, version: true } });
  if (policies.length > 1) fail2("This fleet has more than one active eligibility policy of this kind. Retire one before reviewing.");
  if (policies[0]) return policies[0];
  return tx.policy.create({ data: { fleetId, kind, status: "active", name: kind === "driver_eligibility" ? "Driver document review" : "Vehicle document review", version: "1", requirements: { documents: kind === "driver_eligibility" ? DRIVER_DOCUMENTS : VEHICLE_DOCUMENTS } }, select: { id: true, version: true } });
}
async function createFleet(_root, args, context) {
  const actor = await requireActor2(context);
  if (!await permissions.canManageFleet({ context, session: context.session })) fail2("Fleet management permission is required.");
  const name = text13(args.name, "Fleet name", { required: true, max: 120 });
  const currencyCode = text13(args.currencyCode, "Currency", { max: 3 }).toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(currencyCode)) fail2("Currency must be a three-letter code such as USD.");
  const timezone = text13(args.timezone, "Time zone", { max: 64 }) || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    fail2("Time zone is not recognised.");
  }
  return context.prisma.$transaction(async (tx) => {
    const fleet = await tx.fleet.create({ data: { name, slug: `${slugify(name)}-${(0, import_node_crypto12.randomUUID)().slice(0, 6)}`, status: "setup", publicCity: text13(args.publicCity, "City", { max: 120 }), countryCode: text13(args.countryCode, "Country", { max: 2 }).toUpperCase() || "US", currencyCode, timezone }, select: { id: true, name: true, status: true } });
    await tx.fleetMembership.create({ data: { fleetId: fleet.id, userId: actor.id, role: "owner", status: "active", acceptedAt: /* @__PURE__ */ new Date() } });
    return fleet;
  });
}
async function addFleetDriver(_root, args, context) {
  await requireActor2(context);
  const fleetId = await requireFleet2(context, args.fleetId, "drivers");
  const publicName = text13(args.publicName, "Driver name", { required: true, max: 80 });
  const email = text13(args.email, "Email", { max: 200 }).toLowerCase();
  return context.prisma.$transaction(async (tx) => {
    let userId = null;
    if (email) {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, driverProfile: { select: { id: true } } } });
      if (!user) fail2("No account uses that email. The driver signs up first, or leave email empty.");
      if (user.driverProfile) fail2("That account already has a driver profile.");
      userId = user.id;
    }
    return tx.driverProfile.create({ data: { fleetId, userId, publicName, publicBio: text13(args.publicBio, "Bio", { max: 500 }), acceptsScheduled: args.acceptsScheduled !== false, status: "pending_review", dispatchStatus: "offline" }, select: { id: true, publicName: true, status: true } });
  });
}
async function addFleetVehicle(_root, args, context) {
  await requireActor2(context);
  const fleetId = await requireFleet2(context, args.fleetId, "operations");
  const label = text13(args.label, "Vehicle name", { required: true, max: 80 });
  const year = args.year === null || args.year === void 0 ? null : whole(args.year, "Year", 1980, (/* @__PURE__ */ new Date()).getFullYear() + 1);
  const driverIds = [...new Set((args.driverIds || []).filter((id) => typeof id === "string"))].slice(0, 20);
  return context.prisma.$transaction(async (tx) => {
    if (driverIds.length && await tx.driverProfile.count({ where: { id: { in: driverIds }, fleetId } }) !== driverIds.length) fail2("Every assigned driver must belong to this fleet.");
    return tx.vehicle.create({ data: {
      fleetId,
      label,
      make: text13(args.make, "Make", { max: 60 }),
      model: text13(args.model, "Model", { max: 60 }),
      year,
      color: text13(args.color, "Colour", { max: 40 }),
      plateMasked: text13(args.plateMasked, "Plate", { max: 20 }),
      capacity: whole(args.capacity, "Seats", 1, 50, 4),
      wheelchairAccessible: args.wheelchairAccessible === true,
      status: "pending_review",
      ...driverIds.length ? { drivers: { connect: driverIds.map((id) => ({ id })) } } : {}
    }, select: { id: true, label: true, status: true } });
  });
}
async function assignVehicleDrivers(_root, args, context) {
  await requireActor2(context);
  const vehicle = await context.prisma.vehicle.findUnique({ where: { id: args.vehicleId }, select: { id: true, fleetId: true } });
  const fleetId = await requireFleet2(context, vehicle?.fleetId, "operations");
  const driverIds = [...new Set((args.driverIds || []).filter((id) => typeof id === "string"))].slice(0, 20);
  if (driverIds.length && await context.prisma.driverProfile.count({ where: { id: { in: driverIds }, fleetId } }) !== driverIds.length) fail2("Every assigned driver must belong to this fleet.");
  return context.prisma.vehicle.update({ where: { id: vehicle.id }, data: { drivers: { set: driverIds.map((id) => ({ id })) } }, select: { id: true, label: true } });
}
async function addComplianceDocument(_root, args, context) {
  await requireActor2(context);
  if (Boolean(args.driverId) === Boolean(args.vehicleId)) fail2("Attach the document to one driver or one vehicle.");
  const owner = args.driverId ? await context.prisma.driverProfile.findUnique({ where: { id: args.driverId }, select: { id: true, fleetId: true } }) : await context.prisma.vehicle.findUnique({ where: { id: args.vehicleId }, select: { id: true, fleetId: true } });
  await requireFleet2(context, owner?.fleetId, "drivers");
  const kind = oneOf2(args.kind, DOCUMENT_KINDS, "Document type");
  const issuedAt = dateOrNull(args.issuedAt, "Issue date");
  const expiresAt = dateOrNull(args.expiresAt, "Expiry date");
  if (issuedAt && expiresAt && expiresAt <= issuedAt) fail2("Expiry date must be after the issue date.");
  return context.prisma.complianceDocument.create({ data: { ...args.driverId ? { driverId: owner.id } : { vehicleId: owner.id }, kind, status: "submitted", issuer: text13(args.issuer, "Issuer", { max: 120 }), referenceMasked: text13(args.referenceMasked, "Reference", { max: 40 }), issuedAt, expiresAt }, select: { id: true, kind: true, status: true } });
}
async function reviewComplianceDocument(_root, args, context) {
  const actor = await requireActor2(context);
  const document = await context.prisma.complianceDocument.findUnique({ where: { id: args.documentId }, select: { id: true, kind: true, expiresAt: true, driverId: true, vehicleId: true, driver: { select: { fleetId: true } }, vehicle: { select: { fleetId: true } } } });
  const fleetId = await requireFleet2(context, document?.driver?.fleetId || document?.vehicle?.fleetId, "drivers");
  const decision = oneOf2(args.decision, ["accepted_evidence", "rejected_evidence", "revoked"], "Decision");
  if (decision === "accepted_evidence" && document.expiresAt && new Date(document.expiresAt).getTime() <= Date.now()) fail2("This document has expired and cannot be accepted.");
  const notes = text13(args.notes, "Notes", { max: 1e3 });
  return context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`document:${document.id}`}, 0))::text IS NOT NULL`;
    const current = await tx.complianceDocument.findUnique({ where: { id: document.id }, select: { status: true } });
    assertTransition("document", current?.status, decision, "document");
    const updated = await tx.complianceDocument.update({ where: { id: document.id }, data: { status: decision, reviewedAt: /* @__PURE__ */ new Date(), reviewerId: actor.id, reviewNotes: notes }, select: { id: true, status: true } });
    const subject = document.driverId ? "driver" : "vehicle";
    const required = subject === "driver" ? DRIVER_DOCUMENTS : VEHICLE_DOCUMENTS;
    if (decision !== "accepted_evidence" && required.includes(document.kind)) {
      const policy = await eligibilityPolicy(tx, fleetId, subject === "driver" ? "driver_eligibility" : "vehicle_eligibility");
      await tx.policyEvaluation.create({ data: { policyId: policy.id, [`${subject}Id`]: document.driverId || document.vehicleId, outcome: "ineligible", reasons: [`${String(document.kind).replaceAll("_", " ")} ${decision.replaceAll("_", " ")}.`], evidenceSnapshot: { policyVersion: policy.version, documentId: document.id, decision }, evaluatedAt: /* @__PURE__ */ new Date(), evaluatorId: actor.id } });
    }
    return updated;
  });
}
async function reviewDriver(_root, args, context) {
  const actor = await requireActor2(context);
  const driver = await context.prisma.driverProfile.findUnique({ where: { id: args.driverId }, select: { id: true, fleetId: true, status: true, dispatchStatus: true } });
  const fleetId = await requireFleet2(context, driver?.fleetId, "drivers");
  const decision = oneOf2(args.decision, ["active", "paused", "ineligible", "offboarded"], "Decision");
  const notes = text13(args.notes, "Notes", { max: 1e3 });
  return context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`driver:${driver.id}`}, 0))::text IS NOT NULL`;
    const live = await tx.driverProfile.findUnique({ where: { id: driver.id }, select: { status: true, dispatchStatus: true } });
    assertTransition("driver", live?.status, decision, "driver");
    if (decision !== "active" && ["offered", "assigned", "on_trip"].includes(live?.dispatchStatus || "")) fail2("This driver has a live offer or trip. Finish or reassign it first.");
    const documents = await tx.complianceDocument.findMany({ where: { driverId: driver.id }, select: { kind: true, status: true, expiresAt: true } });
    const missing = missingDocuments(documents, DRIVER_DOCUMENTS);
    if (decision === "active" && missing.length) fail2(`Accept the driver's ${missing.map((kind) => kind.replaceAll("_", " ")).join(" and ")} first.`);
    const policy = await eligibilityPolicy(tx, fleetId, "driver_eligibility");
    const expiries = documents.filter((document) => DRIVER_DOCUMENTS.includes(document.kind) && document.expiresAt).map((document) => new Date(document.expiresAt).getTime());
    await tx.policyEvaluation.create({ data: { policyId: policy.id, driverId: driver.id, outcome: decision === "active" ? "eligible" : "ineligible", reasons: [notes || `Driver ${decision === "active" ? "approved" : decision} by operator review.`], evidenceSnapshot: { policyVersion: policy.version, documents: documents.map((document) => ({ kind: document.kind, status: document.status })) }, evaluatedAt: /* @__PURE__ */ new Date(), expiresAt: expiries.length ? new Date(Math.min(...expiries)) : null, evaluatorId: actor.id } });
    return tx.driverProfile.update({ where: { id: driver.id }, data: { status: decision, ...decision === "active" ? {} : { dispatchStatus: "offline" } }, select: { id: true, status: true } });
  });
}
async function reviewVehicle(_root, args, context) {
  const actor = await requireActor2(context);
  const vehicle = await context.prisma.vehicle.findUnique({ where: { id: args.vehicleId }, select: { id: true, fleetId: true } });
  const fleetId = await requireFleet2(context, vehicle?.fleetId, "drivers");
  const decision = oneOf2(args.decision, ["active", "maintenance", "suspended", "retired"], "Decision");
  const notes = text13(args.notes, "Notes", { max: 1e3 });
  return context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`vehicle:${vehicle.id}`}, 0))::text IS NOT NULL`;
    const live = await tx.vehicle.findUnique({ where: { id: vehicle.id }, select: { status: true } });
    assertTransition("vehicle", live?.status, decision, "vehicle");
    if (decision !== "active") {
      const busy = await tx.trip.findFirst({ where: { vehicleId: vehicle.id, status: { in: [...COMMITTED_TRIP_STATUSES] } }, select: { id: true } }) || await tx.matchOffer.findFirst({ where: { vehicleId: vehicle.id, status: { in: ["offered", "accepted"] }, reservationReleasedAt: null }, select: { id: true } });
      if (busy) fail2("This vehicle has a live offer or trip. Finish or reassign it first.");
    }
    const documents = await tx.complianceDocument.findMany({ where: { vehicleId: vehicle.id }, select: { kind: true, status: true, expiresAt: true } });
    const missing = missingDocuments(documents, VEHICLE_DOCUMENTS);
    if (decision === "active" && missing.length) fail2(`Accept the vehicle's ${missing.map((kind) => kind.replaceAll("_", " ")).join(" and ")} first.`);
    const policy = await eligibilityPolicy(tx, fleetId, "vehicle_eligibility");
    const expiries = documents.filter((document) => VEHICLE_DOCUMENTS.includes(document.kind) && document.expiresAt).map((document) => new Date(document.expiresAt).getTime());
    await tx.policyEvaluation.create({ data: { policyId: policy.id, vehicleId: vehicle.id, outcome: decision === "active" ? "eligible" : "ineligible", reasons: [notes || `Vehicle ${decision === "active" ? "approved" : decision} by operator review.`], evidenceSnapshot: { policyVersion: policy.version, documents: documents.map((document) => ({ kind: document.kind, status: document.status })) }, evaluatedAt: /* @__PURE__ */ new Date(), expiresAt: expiries.length ? new Date(Math.min(...expiries)) : null, evaluatorId: actor.id } });
    return tx.vehicle.update({ where: { id: vehicle.id }, data: { status: decision }, select: { id: true, status: true } });
  });
}
async function setDriverAvailability(_root, args, context) {
  await requireActor2(context);
  const driver = await context.prisma.driverProfile.findUnique({ where: { id: args.driverId }, select: { id: true, fleetId: true } });
  await requireFleet2(context, driver?.fleetId, "operations");
  const timezone = text13(args.timezone, "Time zone", { required: true, max: 64 });
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    fail2("Time zone is not recognised.");
  }
  if (!Array.isArray(args.rules) || args.rules.length > 21) fail2("Up to 21 time windows can be saved.");
  const rules = args.rules.map((rule) => {
    const dayOfWeek = whole(rule.dayOfWeek, "Day", 0, 6);
    if (!TIME.test(rule.startTime) || !TIME.test(rule.endTime) || rule.endTime <= rule.startTime) fail2("Each window needs a start before its end, in HH:MM.");
    return { dayOfWeek, startTime: rule.startTime, endTime: rule.endTime };
  });
  return context.prisma.$transaction(async (tx) => {
    await tx.availabilityRule.updateMany({ where: { driverId: driver.id, status: "active" }, data: { status: "paused" } });
    for (const rule of rules) await tx.availabilityRule.create({ data: { driverId: driver.id, ...rule, timezone, status: "active" } });
    return { driverId: driver.id, rules: rules.length };
  });
}
async function createServiceArea(_root, args, context) {
  await requireActor2(context);
  const fleetId = await requireFleet2(context, args.fleetId, "fleetAdmin");
  return context.prisma.serviceArea.create({ data: { fleetId, name: text13(args.name, "Area name", { required: true, max: 120 }), publicRegionLabel: text13(args.publicRegionLabel, "Public area label", { required: true, max: 160 }), countryCode: text13(args.countryCode, "Country", { max: 2 }).toUpperCase() || "US", status: oneOf2(args.status, ["draft", "active", "paused"], "Status", "active") }, select: { id: true, name: true, status: true } });
}
async function createRideService(_root, args, context) {
  await requireActor2(context);
  const fleetId = await requireFleet2(context, args.fleetId, "fleetAdmin");
  const name = text13(args.name, "Service name", { required: true, max: 80 });
  const areaIds = [...new Set((args.serviceAreaIds || []).filter((id) => typeof id === "string"))].slice(0, 50);
  if (!areaIds.length) fail2("Choose at least one service area.");
  return context.prisma.$transaction(async (tx) => {
    if (await tx.serviceArea.count({ where: { id: { in: areaIds }, fleetId } }) !== areaIds.length) fail2("Every service area must belong to this fleet.");
    return tx.rideService.create({ data: {
      fleetId,
      name,
      slug: `${slugify(name)}-${(0, import_node_crypto12.randomUUID)().slice(0, 6)}`,
      description: text13(args.description, "Description", { max: 500 }),
      category: oneOf2(args.category, ["standard", "comfort", "xl", "accessible", "pet_friendly", "scheduled"], "Category", "standard"),
      passengerCapacity: whole(args.passengerCapacity, "Seats", 1, 50, 4),
      wheelchairAccessible: args.wheelchairAccessible === true,
      advanceBookingMinutes: whole(args.advanceBookingMinutes, "Book-ahead minutes", 0, 43200, 0),
      status: oneOf2(args.status, ["draft", "active", "paused"], "Status", "draft"),
      serviceAreas: { connect: areaIds.map((id) => ({ id })) }
    }, select: { id: true, name: true, status: true } });
  });
}
async function createFareRule(_root, args, context) {
  await requireActor2(context);
  const service = await context.prisma.rideService.findUnique({ where: { id: args.serviceId }, select: { id: true, fleetId: true, fleet: { select: { currencyCode: true } } } });
  const fleetId = await requireFleet2(context, service?.fleetId, "fleetAdmin");
  const area = await context.prisma.serviceArea.findFirst({ where: { id: args.serviceAreaId, fleetId, services: { some: { id: service.id } } }, select: { id: true } });
  if (!area) fail2("Choose a service area this service runs in.");
  const minor = (value, label) => whole(value, label, 0, 1e7, 0);
  const data = {
    fleetId,
    serviceId: service.id,
    serviceAreaId: area.id,
    name: text13(args.name, "Fare name", { required: true, max: 120 }),
    currencyCode: (text13(args.currencyCode, "Currency", { max: 3 }) || service.fleet?.currencyCode || "USD").toUpperCase(),
    distanceUnit: oneOf2(args.distanceUnit, ["kilometer", "mile"], "Distance unit", "mile"),
    baseFareMinor: minor(args.baseFareMinor, "Base fare"),
    perDistanceUnitMinor: minor(args.perDistanceUnitMinor, "Distance rate"),
    perMinuteMinor: minor(args.perMinuteMinor, "Time rate"),
    bookingFeeMinor: minor(args.bookingFeeMinor, "Booking fee"),
    minimumFareMinor: minor(args.minimumFareMinor, "Minimum fare"),
    cancellationFeeMinor: minor(args.cancellationFeeMinor, "Cancellation fee"),
    noShowFeeMinor: minor(args.noShowFeeMinor, "No-show fee"),
    status: oneOf2(args.status, ["draft", "active", "retired"], "Status", "active")
  };
  return context.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fare:${service.id}:${area.id}`}, 0))::text IS NOT NULL`;
    const latest = await tx.fareRule.findFirst({ where: { serviceId: service.id, serviceAreaId: area.id }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (latest?.version || 0) + 1;
    try {
      validateFareRule({ ...data, version });
    } catch {
      fail2("Check the currency and amounts.");
    }
    if (data.status === "active") await tx.fareRule.updateMany({ where: { serviceId: service.id, serviceAreaId: area.id, status: "active" }, data: { status: "retired" } });
    return tx.fareRule.create({ data: { ...data, version }, select: { id: true, name: true, version: true, status: true } });
  });
}
async function setDriverOnline(_root, args, context) {
  const actor = await requireActor2(context);
  const driver = args.driverId ? await context.prisma.driverProfile.findUnique({ where: { id: args.driverId }, select: { id: true, fleetId: true, status: true, dispatchStatus: true } }) : await context.prisma.driverProfile.findFirst({ where: { userId: actor.id }, select: { id: true, fleetId: true, status: true, dispatchStatus: true } });
  if (!driver) fail2("No driver profile found.");
  if (args.driverId) await requireFleet2(context, driver.fleetId, "operations");
  if (driver.status !== "active") fail2("Only approved drivers can go online.");
  if (!args.online && driver.fleetId) await releaseElapsedOffers(context.prisma, { fleetId: driver.fleetId, driverId: driver.id });
  return context.prisma.$transaction(async (tx) => {
    if (args.online) {
      await tx.driverProfile.updateMany({ where: { id: driver.id, status: "active", dispatchStatus: "offline" }, data: { dispatchStatus: "available" } });
      await refreshDriverPresentDispatchStatus(tx, driver.id);
    } else {
      const result = await tx.driverProfile.updateMany({ where: { id: driver.id, dispatchStatus: { in: ["available", "offline"] } }, data: { dispatchStatus: "offline" } });
      if (result.count !== 1) fail2("Finish or decline your current offer or trip before going offline.");
    }
    return tx.driverProfile.findUnique({ where: { id: driver.id }, select: { id: true, dispatchStatus: true } });
  });
}

// features/keystone/mutations/index.ts
var graphql2 = String.raw;
var typeDefs = graphql2`
    type MarketplaceFleet { logoIcon: String, logoColor: String, id: ID!, name: String!, publicDescription: String, heroImageUrl: String, publicCity: String, countryCode: String }
    type RideshareExtension { schema: String!, value: JSON! }
    type RideReadiness { bookingEnabled: Boolean!, mode: String!, reason: String! }
    type OfferMaintenanceResult { releasedCount: Int!, hasMore: Boolean! }
    type PublicServiceArea { id: ID!, name: String!, publicRegionLabel: String!, countryCode: String }
    type PublicServiceAreaPage { items: [PublicServiceArea!]!, nextCursor: ID }
    type MarketplaceRideshareService { nextCursor: String, areasTruncated: Boolean!, id: ID!, title: String!, description: String, photoUrl: String, category: String!, passengerCapacity: Int!, wheelchairAccessible: Boolean!, advanceBookingMinutes: Int!, publicRegionLabels: [String!]!, fleet: MarketplaceFleet!, startingFareMinor: Int, currencyCode: String!, extension: RideshareExtension!, readiness: RideReadiness! }
    type FareBreakdown { currencyCode: String!, baseFareMinor: Int!, distanceMinor: Int!, durationMinor: Int!, bookingFeeMinor: Int!, multiplierBasisPoints: Int!, subtotalMinor: Int!, totalMinor: Int! }
    type MarketplaceRideQuote { quoteId: ID!, quoteProof: String!, expiresAt: DateTime!, pickupLabel: String!, dropoffLabel: String!, scheduledFor: DateTime, estimatedDistanceMeters: Int!, estimatedDurationSeconds: Int!, cancellationFeeMinor: Int!, noShowFeeMinor: Int!, fare: FareBreakdown!, estimateDisclosure: String!, sourceCheckoutPath: String! }
    type RideEstimateOption { serviceId: ID!, totalMinor: Int!, currencyCode: String!, cancellationFeeMinor: Int!, noShowFeeMinor: Int! }
    type RideEstimates { distanceMeters: Int!, durationSeconds: Int!, provider: String!, options: [RideEstimateOption!]! }
    type RideRequestReceipt { requestId: ID!, requestNumber: String!, status: String!, requestProof: String!, replayed: Boolean! }
    type RideIntentResolution { kind: String!, quoteId: ID!, receipt: RideRequestReceipt }
    type RideRequestCancellation { requestId: ID!, status: String!, replayed: Boolean!, alreadyCancelled: Boolean! }
    type PublicRequestTrip { fleetBrand: JSON, id: ID!, historyTruncated: Boolean!, confirmationCode: String!, status: String!, scheduledFor: DateTime, acceptedAt: DateTime, enRouteAt: DateTime, arrivedAt: DateTime, startedAt: DateTime, completedAt: DateTime, cancelledAt: DateTime, pickupLabel: String, dropoffLabel: String, bookingSnapshot: JSON!, finalFareSnapshot: JSON, events: [PublicTripEvent!]!, payments: [PublicTripPayment!]!, reviews: [PublicTripReview!]! }
    type PublicRideshareRequest { fleetBrand: JSON, requestId: ID!, requestNumber: String!, status: String!, requestedFor: DateTime, pickupLabel: String, dropoffLabel: String, createdAt: DateTime!, handoffState: String!, trip: PublicRequestTrip }
    type RiderRequestHistory { items: [PublicRideshareRequest!]!, nextCursor: ID }
    type OperatorTripHandoff { available: Boolean!, tripId: ID!, status: String!, requestId: ID, requestNumber: String, requestStatus: String, acceptedOfferId: ID, historyTruncated: Boolean!, events: [PublicTripEvent!]!, nextCursor: String }
    type RideOfferResponse { accepted: Boolean!, requestId: ID!, tripId: ID, confirmationCode: String, tripToken: String }
    type RideshareBootstrapResult { fleetId: ID!, created: Boolean!, summary: JSON! }
    type PublicTripEvent { eventType: String!, fromStatus: String, toStatus: String, occurredAt: DateTime! }
    type TripCardPayment { enabled: Boolean!, payable: Boolean!, status: String, amountMinor: Int, currencyCode: String, url: String, savedCard: SavedCard, failure: String }
    type SavedCard { brand: String!, last4: String!, expMonth: Int, expYear: Int }
    type RiderSavedCard { enabled: Boolean!, card: SavedCard }
    type RiderCardSetupResult { saved: Boolean!, card: SavedCard }
    type PublicTripPayment { amountMinor: Int, currencyCode: String, status: String }
    type PublicTripDriver { publicName: String!, photoUrl: String, rating: Float, ratingCount: Int }
    type PublicTripReview { direction: String, rating: Int, body: String, status: String, submittedAt: DateTime }
    type PublicRideshareTrip { driver: PublicTripDriver, requestId: ID!, fleetBrand: JSON, id: ID!, historyTruncated: Boolean!, confirmationCode: String!, status: String!, scheduledFor: DateTime, acceptedAt: DateTime, enRouteAt: DateTime, arrivedAt: DateTime, startedAt: DateTime, completedAt: DateTime, cancelledAt: DateTime, pickupLabel: String, dropoffLabel: String, bookingSnapshot: JSON!, finalFareSnapshot: JSON, events: [PublicTripEvent!]!, payments: [PublicTripPayment!]!, reviews: [PublicTripReview!]! }
    type DriverWorkspaceDriver { id: ID!, publicName: String!, status: String, dispatchStatus: String }
    type DriverWorkspaceRequest { id: ID!, requestNumber: String!, requestedFor: DateTime, passengerCount: Int, pickupLabel: String, dropoffLabel: String }
    type DriverWorkspaceVehicle { id: ID!, label: String!, make: String, model: String, color: String, plateMasked: String }
    type DriverWorkspaceOffer { id: ID!, status: String!, offeredAt: DateTime, expiresAt: DateTime!, request: DriverWorkspaceRequest, vehicle: DriverWorkspaceVehicle }
    type DriverWorkspaceTripVehicle { id: ID!, label: String!, plateMasked: String }
    type DriverWorkspaceTrip { acceptedOfferId: ID, id: ID!, confirmationCode: String!, status: String!, scheduledFor: DateTime, pickupLabel: String, dropoffLabel: String, vehicle: DriverWorkspaceTripVehicle }
    type DriverWorkspace { actorId: ID!, offersNextCursor: String, tripsNextCursor: String, driver: DriverWorkspaceDriver, offers: [DriverWorkspaceOffer!]!, trips: [DriverWorkspaceTrip!]!, actionsEnabled: Boolean!, actionsBlockedReason: String }
    type RiderTripSummary { id: ID!, confirmationCode: String!, status: String!, scheduledFor: DateTime, pickupLabel: String, dropoffLabel: String, bookingSnapshot: JSON!, finalFareSnapshot: JSON, createdAt: DateTime! }
    type Query {
      redirectToInit: Boolean
      marketplaceRideshareServices(query: String, location: String, limit: Int, after: String): [MarketplaceRideshareService!]!
      marketplaceRidesharePopularPlaces(serviceId: ID!): [String!]!
      marketplaceRideshareEstimates(pickupPoint: JSON!, dropoffPoint: JSON!): RideEstimates!
      marketplaceRideshareService(id: ID!): MarketplaceRideshareService
      marketplaceRideshareServiceAreas(serviceId: ID!, after: ID): PublicServiceAreaPage!
      publicRideshareTrip(confirmationCode: String!, tripToken: String, requestId: ID, requestProof: String): PublicRideshareTrip
      riderRequestStatus(requestId: ID!, requestProof: String): PublicRideshareRequest
      myRideshareRequests(cursor: ID): RiderRequestHistory!
      operatorTripHandoff(tripId: ID!, cursor: String): OperatorTripHandoff
      publicRideshareRequest(requestId: ID!, requestProof: String!): PublicRideshareRequest
      myDriverWorkspace(offersCursor: String, tripsCursor: String): DriverWorkspace!
      myRideshareTrips: [RiderTripSummary!]!
      safetyQueueScope: Boolean!
      financeQueueScope: Boolean!
      rideshareCapabilities: JSON!
      riderAccountOptions: JSON!
      fleetBranding(fleetId: ID!): JSON
      tripCancellationPreview(tripId: ID!): JSON
      riderRequestCancellationPreview(requestId: ID!, requestProof: String): JSON
      riderTripHistory(requestId: ID!, requestProof: String, kind: String!, cursor: String): JSON
      dispatchCandidatePage(requestId: ID!, cursor: String, query: String): JSON
      dispatchQueueScope: Boolean!
      tripCardPayment(tripId: ID!): TripCardPayment!
      riderSavedCard: RiderSavedCard!
      driverEarningsReport(from: String, to: String): JSON!
    }
    type Mutation {
      createOperatorRide(idempotencyKey: String!, serviceId: ID!, pickupLabel: String!, dropoffLabel: String!, pickupPoint: JSON, dropoffPoint: JSON, scheduledFor: DateTime, passengerCount: Int, wheelchairAccessible: Boolean, riderName: String!, riderPhone: String!, receiptEmail: String, notes: String): JSON!
      marketplaceRideshareQuote(serviceId: ID!, pickupLabel: String!, dropoffLabel: String!, pickupPoint: JSON, dropoffPoint: JSON, scheduledFor: DateTime, passengerCount: Int, wheelchairAccessible: Boolean, handoffId: String): MarketplaceRideQuote!
      requestRide(quoteId: ID!, quoteProof: String!, passengerCount: Int, accessibilityNeeds: JSON, riderNotes: String, preciseRouteEncryptedRef: String, receiptEmail: String): RideRequestReceipt!
      resolveRideRequestIntent(quoteId: ID!, quoteProof: String!, passengerCount: Int, accessibilityNeeds: JSON, riderNotes: String, preciseRouteEncryptedRef: String): RideIntentResolution!
      offerRideToDriver(requestId: ID!, driverId: ID!, vehicleId: ID!, expiresInSeconds: Int, idempotencyKey: String!, expectedActorId: ID!): MatchOffer!
      respondToRideOffer(offerId: ID!, response: String!, reason: String, idempotencyKey: String!): RideOfferResponse!
      transitionTrip(tripId: ID!, action: String!, reason: String, idempotencyKey: String!, expectedActorId: ID!, expectedAcceptedOfferId: ID!): Trip!
      cancelRideRequest(requestId: ID!, requestProof: String, idempotencyKey: String!, expectedActorId: ID!): RideRequestCancellation!
      cancelRide(tripId: ID!, tripToken: String, reasonCode: String!, reason: String, idempotencyKey: String!, reassign: Boolean, expectedActorId: ID!, expectedAcceptedOfferId: ID!, expectedUpdatedAt: DateTime!, expectedFeeMinor: Int!, expectedCurrencyCode: String!): Cancellation!
      recordTripLocation(tripId: ID!, recordedAt: DateTime, coarseGeohash: String, encryptedCoordinateRef: String!, accuracyMeters: Int, providerEvidence: JSON): LocationEvent!
      submitTripReview(tripId: ID!, tripToken: String, rating: Int!, body: String, idempotencyKey: String!): Review!
      reportSafetyIncident(tripId: ID!, tripToken: String, severity: String, category: String, summary: String!, restrictedDetails: JSON, evidenceRefs: JSON, idempotencyKey: String!): SafetyIncident!
      openSupportCase(tripId: ID!, tripToken: String, category: String, subject: String!, description: String!, idempotencyKey: String!): SupportCase!
      sendTripMessage(tripId: ID!, tripToken: String, body: String!, idempotencyKey: String!): Message!
      initiateTripPayment(tripId: ID!, providerCode: String!, idempotencyKey: String!): Payment!
      requestTripRefund(paymentId: ID!, amountMinor: Int!, reason: String, idempotencyKey: String!): Refund!
      startTripCardPayment(tripId: ID!): TripCardPayment!
      confirmTripCardPayment(tripId: ID!): TripCardPayment!
      startRiderCardSetup(returnTo: String): JSON!
      confirmRiderCardSetup(sessionId: String!): RiderCardSetupResult!
      removeRiderCard: JSON!
      retryTripCharge(paymentId: ID!): JSON!
      reportDriverLocation(lng: Float!, lat: Float!, accuracyMeters: Float): JSON!
      saveFleetBranding(fleetId: ID!, expectedUpdatedAt: DateTime!, logoIcon: String!, logoColor: String!, name: String, idempotencyKey: String!, expectedActorId: ID!): JSON!
      dismissRideshareOnboarding: Boolean!
      bootstrapRideshare(mode: String!): RideshareBootstrapResult!
      refreshRideshareClocks: JSON!
      expireRideOffers(fleetId: ID!): OfferMaintenanceResult!
      expireRequestFleetOffers(requestId: ID!): OfferMaintenanceResult!
      setupFleet(name: String!, publicCity: String, countryCode: String, currencyCode: String, timezone: String): JSON!
      addFleetDriver(fleetId: ID!, publicName: String!, email: String, acceptsScheduled: Boolean, publicBio: String): JSON!
      addFleetVehicle(fleetId: ID!, label: String!, make: String, model: String, year: Int, color: String, plateMasked: String, capacity: Int, wheelchairAccessible: Boolean, driverIds: [ID!]): JSON!
      assignVehicleDrivers(vehicleId: ID!, driverIds: [ID!]!): JSON!
      setDriverOnline(online: Boolean!, driverId: ID): JSON!
      addFleetMember(fleetId: ID!, email: String!, role: String!): JSON!
      updateFleetMember(membershipId: ID!, role: String, status: String): JSON!
      addDriverTimeOff(driverId: ID!, startsAt: DateTime!, endsAt: DateTime!, kind: String, reason: String): JSON!
      removeDriverTimeOff(exceptionId: ID!): JSON!
      triageSafetyIncident(incidentId: ID!, status: String, assignToMe: Boolean): JSON!
      triageSupportCase(caseId: ID!, status: String, assignToMe: Boolean): JSON!
      moderateReview(reviewId: ID!, status: String!, reason: String): JSON!
      confirmManualPayment(paymentId: ID!, method: String): JSON!
      confirmManualRefund(refundId: ID!): JSON!
      addComplianceDocument(driverId: ID, vehicleId: ID, kind: String!, issuer: String, referenceMasked: String, issuedAt: DateTime, expiresAt: DateTime): JSON!
      reviewComplianceDocument(documentId: ID!, decision: String!, notes: String): JSON!
      reviewDriver(driverId: ID!, decision: String!, notes: String): JSON!
      reviewVehicle(vehicleId: ID!, decision: String!, notes: String): JSON!
      setDriverAvailability(driverId: ID!, timezone: String!, rules: JSON!): JSON!
      setupServiceArea(fleetId: ID!, name: String!, publicRegionLabel: String!, countryCode: String, status: String): JSON!
      setupRideService(fleetId: ID!, name: String!, description: String, category: String, passengerCapacity: Int, wheelchairAccessible: Boolean, advanceBookingMinutes: Int, serviceAreaIds: [ID!]!, status: String): JSON!
      setupFareRule(serviceId: ID!, serviceAreaId: ID!, name: String!, currencyCode: String, distanceUnit: String, baseFareMinor: Int!, perDistanceUnitMinor: Int!, perMinuteMinor: Int!, bookingFeeMinor: Int, minimumFareMinor: Int, cancellationFeeMinor: Int, noShowFeeMinor: Int, status: String): JSON!
    }
  `;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({ schemas: [baseSchema], typeDefs, resolvers: {
    ...dateTimeFieldResolvers(typeDefs),
    Query: {
      redirectToInit: redirectToInit_default,
      marketplaceRideshareServices,
      marketplaceRideshareService,
      marketplaceRideshareServiceAreas,
      marketplaceRidesharePopularPlaces,
      marketplaceRideshareEstimates,
      publicRideshareTrip,
      publicRideshareRequest,
      myDriverWorkspace: dispatchOnDriverRead(myDriverWorkspace),
      myRideshareTrips,
      riderRequestStatus: dispatchOnPoll(riderRequestStatus),
      myRideshareRequests,
      operatorTripHandoff,
      safetyQueueScope: (_root, _args, context) => hasAnyFleetScope(context, context.session, "safety"),
      financeQueueScope: (_root, _args, context) => hasAnyFleetScope(context, context.session, "finance"),
      rideshareCapabilities: async (_root, _args, context) => ({
        ...Object.fromEntries(await Promise.all(["operations", "drivers", "finance", "safety", "fleetAdmin"].map(async (capability) => [capability, await hasAnyFleetScope(context, context.session, capability)]))),
        driver: Boolean(humanSessionId(context.session)) && Boolean(await context.prisma.driverProfile.findFirst({ where: { userId: humanSessionId(context.session) }, select: { id: true } }))
      }),
      driverEarningsReport,
      tripCardPayment,
      riderSavedCard,
      tripCancellationPreview,
      riderRequestCancellationPreview,
      riderTripHistory,
      fleetBranding,
      dispatchCandidatePage,
      dispatchQueueScope: (_root, _args, context) => hasAnyFleetScope(context, context.session, "operations"),
      riderAccountOptions: async (_root, _args, context) => ({ registrationEnabled: await riderSignupsOpen(context.prisma) })
    },
    Mutation: { createOperatorRide, startTripCardPayment, confirmTripCardPayment, startRiderCardSetup, confirmRiderCardSetup, removeRiderCard, retryTripCharge, reportDriverLocation, addFleetMember, updateFleetMember, addDriverTimeOff, removeDriverTimeOff, triageSafetyIncident: updateSafetyIncident, triageSupportCase: updateSupportCase, moderateReview, confirmManualPayment, confirmManualRefund, setupFleet: createFleet, addFleetDriver, addFleetVehicle, assignVehicleDrivers, addComplianceDocument, reviewComplianceDocument, reviewDriver, reviewVehicle, setDriverAvailability, setDriverOnline: autoDispatchAfter(setDriverOnline, "online"), setupServiceArea: createServiceArea, setupRideService: createRideService, setupFareRule: createFareRule, saveFleetBranding, marketplaceRideshareQuote, requestRide: autoDispatchAfter(requestRide, "request"), resolveRideRequestIntent, offerRideToDriver, respondToRideOffer: autoDispatchAfter(respondToRideOffer, "response"), transitionTrip: receiptAfterTransition(chargeAfterTransition(transitionTrip)), cancelRideRequest, cancelRide: chargeAfterCancel(cancelRide), recordTripLocation, submitTripReview, reportSafetyIncident, openSupportCase, sendTripMessage, initiateTripPayment, requestTripRefund, bootstrapRideshare, dismissRideshareOnboarding, refreshRideshareClocks, expireRideOffers, expireRequestFleetOffers }
  } });
}

// features/keystone/lib/mail.ts
var import_nodemailer2 = require("nodemailer");
init_email_layout();
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport2 = (0, import_nodemailer2.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`
  });
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport2.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.SMTP_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer2.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/index.ts
init_access();

// features/keystone/database-url.ts
var POOL_SIZES = { web: 15, worker: 5 };
var OVERRIDE_ENV = {
  web: "DATABASE_CONNECTION_LIMIT",
  worker: "DATABASE_CONNECTION_LIMIT_WORKER"
};
function pooledDatabaseUrl(url, role = "web") {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.searchParams.has("connection_limit")) return url;
  const override = Number(process.env[OVERRIDE_ENV[role]]);
  parsed.searchParams.set("connection_limit", String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role]));
  return parsed.toString();
}

// features/keystone/lib/keystonePrismaErrors.ts
var RAW_METHOD = /^\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|queryRawTyped|runCommandRaw)$/;
var clients = /* @__PURE__ */ new WeakMap();
var delegates = /* @__PURE__ */ new WeakMap();
function isKeystonePrismaError(value) {
  return value instanceof Error && value.extensions?.code === "KS_PRISMA_ERROR";
}
function rethrowKeystonePrismaError(value) {
  if (!isKeystonePrismaError(value)) return value;
  const prisma = value.extensions.prisma ?? {};
  throw Object.assign(value, { code: prisma.code, meta: prisma.meta, clientVersion: prisma.clientVersion });
}
function throwing(result) {
  if (!result || typeof result.then !== "function") return rethrowKeystonePrismaError(result);
  const settled = () => result.then(rethrowKeystonePrismaError);
  return new Proxy(result, {
    get(target, key) {
      if (key === "then") return (ok, fail3) => settled().then(ok, fail3);
      if (key === "catch") return (fail3) => settled().catch(fail3);
      if (key === "finally") return (done) => settled().finally(done);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function throwingDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? (...args) => throwing(value.apply(target, args)) : value;
    }
  });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function throwKeystonePrismaErrors(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "$transaction" && typeof value === "function") {
        return (work, ...options) => {
          if (typeof work === "function") return value.call(target, (tx) => work(throwKeystonePrismaErrors(tx)), ...options);
          return Promise.resolve(value.call(target, work, ...options)).then((results) => Array.isArray(results) ? results.map(rethrowKeystonePrismaError) : results);
        };
      }
      if (key === "$extends" && typeof value === "function") return (...args) => throwKeystonePrismaErrors(value.apply(target, args));
      if (typeof key === "string" && RAW_METHOD.test(key) && typeof value === "function") return (...args) => throwing(value.apply(target, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof key === "string" && !key.startsWith("$") && value && typeof value === "object" && typeof value.findFirst === "function") return throwingDelegate(value);
      return value;
    }
  });
  clients.set(client, wrapped);
  return wrapped;
}

// features/keystone/index.ts
var production = process.env.NODE_ENV === "production";
var databaseURL = process.env.DATABASE_URL || "postgresql://localhost/openfront_rideshare";
var sessionSecret = process.env.SESSION_SECRET || "development-only-session-secret-change-me-now";
if (production && (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || sessionSecret.length < 32)) throw new Error("DATABASE_URL and SESSION_SECRET of at least 32 characters are required in production.");
var session = (0, import_session.statelessSessions)({ maxAge: 60 * 60 * 24 * 30, secret: sessionSecret });
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  // The first user's Admin role is assigned by the User resolveInput hook (see models/User.ts).
  initFirstItem: { fields: ["name", "email", "password"] },
  passwordResetLink: { async sendToken(args) {
    await sendPasswordResetEmail(args.token, args.identity);
  } },
  sessionData: `id name email role { id name ${permissionNames.join(" ")} }`
});
function productionEnv(name, developmentFallback) {
  if (process.env[name]) return process.env[name];
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is required in production`);
  return developmentFallback;
}
var s3Endpoint = productionEnv("S3_ENDPOINT", "https://sfo3.digitaloceanspaces.com");
var storage = {
  my_images: {
    kind: "s3",
    type: "image",
    bucketName: productionEnv("S3_BUCKET_NAME", "keystone-test"),
    region: productionEnv("S3_REGION", "ap-southeast-2"),
    accessKeyId: productionEnv("S3_ACCESS_KEY_ID", "keystone"),
    secretAccessKey: productionEnv("S3_SECRET_ACCESS_KEY", "keystone"),
    endpoint: s3Endpoint,
    forcePathStyle: s3ForcePathStyle(s3Endpoint),
    signed: { expiry: 5e3 }
  }
};
var keystone_default = withAuth((0, import_core14.config)({
  db: { provider: "postgresql", url: pooledDatabaseUrl(databaseURL), extendPrismaClient: throwKeystonePrismaErrors },
  lists: withItemViewAwareUi(withDeleteAwareUi(withCreateAwareUi(models))),
  session,
  graphql: { extendGraphqlSchema },
  storage,
  ui: { isAccessAllowed: (context) => permissions.canAccessDashboard({ context, session: context.session }) }
}));

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
