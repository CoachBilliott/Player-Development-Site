/* global fetch, AbortSignal */
import { Buffer } from 'node:buffer'
import console from 'node:console'
import { createPrivateKey, sign } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { URLSearchParams } from 'node:url'

// Read-only Apple status check. Credentials and bearer tokens never leave this process.
const appId = '6826677846'
const bundleId = 'com.coachbilliott.playerdevelopment'
const buildNumber = process.env.PD_BUILD_NUMBER
const keyId = process.env.PD_ASC_KEY_ID?.trim()
const issuer = process.env.PD_ASC_ISSUER_ID?.trim()
if (!/^[1-9][0-9]{0,3}$/.test(buildNumber ?? '') ||
    !/^[A-Z0-9]{10}$/.test(keyId ?? '') ||
    !/^[0-9a-f-]{36}$/i.test(issuer ?? '')) {
  throw new Error('Invalid Apple status-check configuration.')
}
const key = createPrivateKey(process.env.PD_ASC_PRIVATE_KEY ?? '')
if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails.namedCurve !== 'prime256v1') {
  throw new Error('Expected an Apple ES256 API key.')
}
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const unsigned = `${encode({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${encode({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`
const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' })
const token = `${unsigned}.${signature.toString('base64url')}`

async function read(path, optional = false) {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    if (optional && [403, 404].includes(response.status)) return { unavailable: response.status }
    // Do not print arbitrary response bodies or request headers.
    throw new Error(`Apple status API returned HTTP ${response.status}.`)
  }
  return response.json()
}

const app = (await read(`apps/${appId}`)).data
if (app?.attributes?.bundleId !== bundleId) throw new Error('Apple app identity mismatch.')
const results = await read(`builds?${new URLSearchParams({ 'filter[app]': appId, 'filter[version]': buildNumber, include: 'preReleaseVersion,buildBetaDetail', limit: '10' })}`)
const builds = results.data.map((build) => {
  const related = (relation) => results.included?.find((item) => item.id === build.relationships?.[relation]?.data?.id && item.type === build.relationships?.[relation]?.data?.type)
  const beta = related('buildBetaDetail')?.attributes
  return {
    id: build.id, buildNumber: build.attributes.version,
    version: related('preReleaseVersion')?.attributes.version ?? null,
    uploadedDate: build.attributes.uploadedDate,
    processingState: build.attributes.processingState,
    expired: build.attributes.expired,
    expirationDate: build.attributes.expirationDate,
    usesNonExemptEncryption: build.attributes.usesNonExemptEncryption ?? null,
    internalBuildState: beta?.internalBuildState ?? null,
    externalBuildState: beta?.externalBuildState ?? null,
  }
})
const groups = await read(`apps/${appId}/betaGroups?limit=100`, true)
const review = await read(`apps/${appId}/betaAppReviewDetail`, true)
const reviewAttributes = review.data?.attributes
const report = {
  checkedAt: new Date().toISOString(), appId, bundleId, appName: app.attributes.name,
  requestedBuildNumber: buildNumber, builds,
  betaGroups: groups.data?.map(({ id, attributes }) => ({ id, name: attributes.name, isInternalGroup: attributes.isInternalGroup, publicLinkEnabled: attributes.publicLinkEnabled, publicLink: attributes.publicLinkEnabled ? attributes.publicLink : null })) ?? { unavailable: groups.unavailable },
  reviewDetails: reviewAttributes ? {
    hasContactFirstName: !!reviewAttributes.contactFirstName,
    hasContactLastName: !!reviewAttributes.contactLastName,
    hasContactPhone: !!reviewAttributes.contactPhone,
    hasContactEmail: !!reviewAttributes.contactEmail,
    hasReviewNotes: !!reviewAttributes.notes,
    demoAccountRequired: reviewAttributes.demoAccountRequired,
    hasDemoAccountName: !!reviewAttributes.demoAccountName,
  } : { unavailable: review.unavailable },
}
await writeFile('testflight-status.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
