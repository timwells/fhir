const Fhir = require('fhir-kit-client');
const fs = require('fs');

// Configuration: Set to true to include Provenance, false to exclude
const includeProvenance = true; // Change to false to exclude Provenance

// Initialize FHIR client (local processing, no server needed)
const fhirClient = new Fhir({ baseUrl: 'http://localhost' });

// Load Message Bundle
const messageBundle = JSON.parse(fs.readFileSync('pathology-message-bundle.json', 'utf8'));

// Extract resources
const messageHeader = messageBundle.entry.find(entry => entry.resource.resourceType === 'MessageHeader').resource;
const diagnosticReport = messageBundle.entry.find(entry => entry.resource.id === messageHeader.focus[0].reference.split('/')[1]).resource;
const patient = messageBundle.entry.find(entry => entry.resource.resourceType === 'Patient').resource;
const observation = messageBundle.entry.find(entry => entry.resource.resourceType === 'Observation').resource;
const organization = messageBundle.entry.find(entry => entry.resource.resourceType === 'Organization').resource;

console.log('Extracted Resources:');
console.log('Message Header:', messageHeader);
console.log('Diagnostic Report:', diagnosticReport);
console.log('Patient:', patient);
console.log('Observation:', observation);
console.log('Organization:', organization);

// Create Composition
const composition = {
  resourceType: 'Composition',
  id: 'comp-001',
  status: 'final',
  type: {
    coding: [{ system: 'http://loinc.org', code: '58410-2', display: 'Complete blood count (CBC) panel' }]
  },
  subject: { reference: `Patient/${patient.id}` },
  author: [{ display: messageHeader.source.name }],
  title: 'Pathology Result Document',
  date: messageHeader.timestamp,
  section: [{
    title: 'Lab Results',
    code: { coding: [{ system: 'http://loinc.org', code: '58410-2' }] },
    entry: [{ reference: `DiagnosticReport/${diagnosticReport.id}` }]
  }]
};

// Create Provenance (if enabled)
const provenance = includeProvenance ? {
  resourceType: 'Provenance',
  id: 'prov-001',
  target: [
    { reference: `Composition/${composition.id}` },
    { reference: `Bundle/doc-20250926-001` }
  ],
  recorded: new Date().toISOString(),
  activity: {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
        code: 'TRANSFORM',
        display: 'Transform'
      }
    ]
  },
  agent: [
    {
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
            code: 'assembler',
            display: 'Assembler'
          }
        ]
      },
      who: { display: 'FHIR Conversion System' }
    }
  ],
  reason: [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
          code: 'TREAT',
          display: 'Treatment'
        }
      ],
      text: 'Converted Message Bundle to Document Bundle for archival storage'
    }
  ]
} : null;

// Create Document Bundle
const documentBundle = {
  resourceType: 'Bundle',
  type: 'document',
  identifier: { system: 'http://example.org/doc-ids', value: 'doc-20250926-001' },
  timestamp: new Date().toISOString(),
  entry: [
    { fullUrl: `urn:uuid:${composition.id}`, resource: composition },
    { fullUrl: `urn:uuid:${diagnosticReport.id}`, resource: diagnosticReport },
    { fullUrl: `urn:uuid:${observation.id}`, resource: observation },
    { fullUrl: `urn:uuid:${patient.id}`, resource: patient },
    { fullUrl: `urn:uuid:${organization.id}`, resource: organization },
    ...(includeProvenance ? [{ fullUrl: `urn:uuid:${provenance.id}`, resource: provenance }] : [])
  ]
};

// Save Document Bundle
fs.writeFileSync('pathology-document-bundle.json', JSON.stringify(documentBundle, null, 2));

// Optional: Validate (requires FHIR server or local profiles)
// fhirClient.validate(documentBundle).then(result => console.log('Validation:', result)).catch(err => console.error('Validation error:', err));
