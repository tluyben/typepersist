```
Text
Password
UUID
Integer
Currency
Float
Double
Decimal
Datetime
Time
Date
CreatedAt
UpdatedAt
Boolean
Binary // legacy: Image = Blob storage
ID // this is whatever db we picked as default db system for the db we are using, usually integer or uuid
Enum
ReferenceOneToOne // same as referencemanytoone
ReferenceManyToOne
ReferenceOneToMany
ReferenceManyToMany // these are built from a onetomany and manytoone relations and require a connecting table which is either automatically created or referred to when importing data
```

examples of table creation and relations;

```
note, for imports, the id's can be just names, as long as they are unique.
    [
      {
        id: 26b41ae4-3eb8-4e5e-8842-e839b07ee336 // mandatory, can be any unique name for importing
        name: SupportTicket // mandatory
        plural: SupportTickets
        createdAt: 2023-07-04T13:48:31.690Z
        updatedAt: 2023-07-04T13:48:31.690Z
        properties: // mandatory
        [
          {
            id: 76b92f96-d0c2-40dc-bacd-831a705cd028
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336 // mandatory
            name: Name // mandatory
            type: Text // mandatory
            required: true // mandatory
            system: false
            createdAt: 2023-07-04T13:48:31.690Z
            updatedAt: 2023-07-04T13:48:31.690Z
          }
          {
            id: 04a2aa3a-b977-44ac-b490-d0e8749b3d63
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336
            name: Email
            type: Text
            actualType: Email
            required: true
            system: false
            createdAt: 2023-07-04T13:48:31.690Z
            updatedAt: 2023-07-04T13:48:31.690Z
          }
          {
            id: b9515f47-96bb-4786-acf1-e4d2206cf5e6
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336
            name: Category
            type: Enum
            required: true
            system: false
            createdAt: 2023-07-04T13:48:31.690Z
            updatedAt: 2023-07-04T13:48:31.690Z
            options:
            [
              General
              Billing
              Technical
              Other
            ]
          }
          {
            id: df1c0179-810e-4c5f-9885-69a23e1a97d8
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336
            name: Subject
            type: Text
            required: true
            system: false
            createdAt: 2023-07-04T13:48:31.691Z
            updatedAt: 2023-07-04T13:48:31.691Z
          }
          {
            id: df1c0179-810e-4c5f-9885-69a23e1a97d8
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336
            name: Description
            type: Text
            maximum: 100000000 //optional
            actualType: 'LongText'
            required: true
            system: false
            createdAt: 2023-07-04T13:48:31.691Z
            updatedAt: 2023-07-04T13:48:31.691Z
          }
          {
            id: c59284fa-d1fd-4fb3-8c01-28ef8ca745fd
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336
            name: Status
            type: Enum
            required: true
            system: false
            createdAt: 2023-07-04T13:48:31.691Z
            updatedAt: 2023-07-04T13:48:31.691Z
            options: // mandatory if enum
            [
              New
              Open
              Resolved
            ]
          }
          {
            id: deed4802-5717-41d9-9a35-adc0656cf7a3
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336
            name: Secret
            type: UUID
            actualType: UUID
            indexed: Unique // optional ; Default, Unique , if not there, not indexed
            required: true
            default: auto // default value, auto here means a randomly genered UUID
            system: false
            createdAt: 2023-07-04T13:48:31.691Z
            updatedAt: 2023-07-04T13:48:31.691Z
          }
          {
            id: 2a4f5691-0cea-4ad0-808a-311781eb26b8
            tableId: 26b41ae4-3eb8-4e5e-8842-e839b07ee336
            name: EmailVerified
            indexed: Default
            type: Boolean
            required: true
            default: false // optional , just default value if not 'auto'
            createdAt: 2023-03-14T08:26:37.265Z
            system: false
            updatedAt: 2023-03-14T08:26:37.265Z
          }
        ]
      }
      {
        id: 174ec5ba-f16d-4bed-85f1-ce59a3a7c6b4
        name: SupportTicketThread
        plural: SupportTicketThreads
        createdAt: 2023-07-04T13:48:31.691Z
        updatedAt: 2023-07-04T13:48:31.691Z
        system: false
        properties:
        [
          {
            id: 043db790-d267-4ac5-94ad-fd04fe76ec44
            tableId: 174ec5ba-f16d-4bed-85f1-ce59a3a7c6b4
            name: SupportTicket
            type: ReferenceManyToOne
            required: true
            foreignTable: SupportTicket
            system: false
            createdAt: 2023-07-04T13:48:31.691Z
            updatedAt: 2023-07-04T13:48:31.691Z
            indexed: Foreign
            indexedFields: // required if Reference
            [
              SupportTicket
            ]
          }
          {
            id: 0f0be3d7-60c1-4423-bbde-4290218b22f1
            tableId: 174ec5ba-f16d-4bed-85f1-ce59a3a7c6b4
            name: Message
            type: Text
            maximum: 100000000
            actualType: 'LongText'
            required: true
            system: false
            createdAt: 2023-07-04T13:48:31.691Z
            updatedAt: 2023-07-04T13:48:31.691Z
          }
          {
            id: 3fda5cd8-c556-44e3-badf-4ba4e1e06f54
            tableId: 174ec5ba-f16d-4bed-85f1-ce59a3a7c6b4
            name: Author
            actualType: FullName
            type: Text
            required: true
            system: false
            createdAt: 2023-07-04T13:48:31.691Z
            updatedAt: 2023-07-04T13:48:31.691Z
          }
          {
            id: 7df097a7-964b-4abb-916f-deb2c26274a9
            tableId: 174ec5ba-f16d-4bed-85f1-ce59a3a7c6b4
            name: StaffMember
            type: Boolean
            required: false
            default: false
            createdAt: 2023-03-14T08:26:37.265Z
            system: false
            updatedAt: 2023-03-14T08:26:37.265Z
          }
        ]
      }
    ]

```
