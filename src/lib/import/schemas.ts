/** What each import type expects. Aliases exist so real spreadsheets map themselves. */
export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  aliases: string[];
}

export interface ImportKind {
  key: 'units' | 'bookings' | 'milestones' | 'customers' | 'leads';
  label: string;
  description: string;
  fields: ImportField[];
  sample: string;
}

export const IMPORT_KINDS: ImportKind[] = [
  {
    key: 'units',
    label: 'Units / inventory',
    description: 'Every flat in a project — code, floor, typology, area and price.',
    fields: [
      { key: 'code', label: 'Unit code', required: true, aliases: ['unit', 'unitno', 'flatno', 'flat', 'unitnumber', 'no'] },
      { key: 'tower', label: 'Tower / block', aliases: ['block', 'wing', 'building'] },
      { key: 'floor', label: 'Floor', aliases: ['floorno', 'level'] },
      { key: 'typology', label: 'Typology', hint: '2BHK, 3BHK…', aliases: ['type', 'config', 'configuration', 'bhk'] },
      { key: 'carpetAreaSqft', label: 'Carpet area (sqft)', aliases: ['carpet', 'carpetarea', 'area', 'sqft', 'saleablearea'] },
      { key: 'price', label: 'Price', aliases: ['rate', 'cost', 'amount', 'value', 'basicprice'] },
      { key: 'facing', label: 'Facing', aliases: ['direction'] },
      { key: 'status', label: 'Status', hint: 'AVAILABLE, HELD, BOOKED, SOLD', aliases: ['availability', 'state'] },
    ],
    sample: 'Unit No\tTower\tFloor\tType\tCarpet Area\tPrice\tFacing\tStatus\nA-101\tA\t1\t2BHK\t1150\t9500000\tEast\tAVAILABLE',
  },
  {
    key: 'customers',
    label: 'Buyers',
    description: 'People who have already bought — for the buyer portal and collections.',
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['buyer', 'customer', 'customername', 'fullname'] },
      { key: 'email', label: 'Email', aliases: ['mail', 'emailid'] },
      { key: 'phone', label: 'Phone', aliases: ['mobile', 'contact', 'phoneno', 'number'] },
      { key: 'unitCode', label: 'Unit code', hint: 'Links the buyer to a flat', aliases: ['unit', 'flat', 'unitno'] },
    ],
    sample: 'Name\tEmail\tPhone\tUnit\nRamesh Kumar\tramesh@example.com\t9876543210\tA-101',
  },
  {
    key: 'bookings',
    label: 'Bookings',
    description: 'Sales already done — links a buyer to a unit with an agreement value.',
    fields: [
      { key: 'unitCode', label: 'Unit code', required: true, aliases: ['unit', 'flat', 'unitno'] },
      { key: 'buyerName', label: 'Buyer name', required: true, aliases: ['customer', 'name', 'buyer'] },
      { key: 'buyerPhone', label: 'Buyer phone', aliases: ['mobile', 'phone', 'contact'] },
      { key: 'agreementValue', label: 'Agreement value', aliases: ['value', 'amount', 'total', 'consideration'] },
      { key: 'bookedAt', label: 'Booking date', hint: 'dd/mm/yyyy', aliases: ['date', 'bookingdate'] },
      { key: 'salesRep', label: 'Sales rep', hint: 'Matched by name', aliases: ['rep', 'executive', 'soldby', 'owner'] },
    ],
    sample: 'Unit\tCustomer\tPhone\tAgreement Value\tBooking Date\tSales Rep\nA-101\tRamesh Kumar\t9876543210\t9500000\t14/03/2026\tPraveen',
  },
  {
    key: 'milestones',
    label: 'Payment schedule',
    description: 'Construction-linked instalments against a booking.',
    fields: [
      { key: 'unitCode', label: 'Unit code', required: true, aliases: ['unit', 'flat', 'unitno'] },
      { key: 'label', label: 'Milestone', required: true, hint: 'On booking, On foundation…', aliases: ['stage', 'description', 'particulars', 'milestone'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['value', 'due', 'instalment', 'installment'] },
      { key: 'dueDate', label: 'Due date', hint: 'dd/mm/yyyy', aliases: ['date', 'duedate'] },
      { key: 'status', label: 'Status', hint: 'PENDING or PAID', aliases: ['paid', 'state'] },
    ],
    sample: 'Unit\tParticulars\tAmount\tDue Date\tStatus\nA-101\tOn booking\t950000\t14/03/2026\tPAID',
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Enquiries, past and present.',
    fields: [
      { key: 'name', label: 'Name', required: true, aliases: ['leadname', 'customer', 'contact'] },
      { key: 'phone', label: 'Phone', aliases: ['mobile', 'contactno', 'number'] },
      { key: 'email', label: 'Email', aliases: ['mail', 'emailid'] },
      { key: 'source', label: 'Source', hint: 'WEBSITE, WALK_IN, REFERRAL…', aliases: ['leadsource', 'channel'] },
      { key: 'status', label: 'Status', aliases: ['stage', 'state'] },
      { key: 'locality', label: 'Locality', aliases: ['area', 'location', 'region'] },
      { key: 'budgetMax', label: 'Budget', aliases: ['budget', 'maxbudget', 'price'] },
      { key: 'requirement', label: 'Requirement', aliases: ['notes', 'remarks', 'comment'] },
      { key: 'owner', label: 'Owner', hint: 'Matched by name', aliases: ['assignedto', 'rep', 'executive'] },
    ],
    sample: 'Name\tPhone\tEmail\tSource\tStatus\tBudget\tOwner\nAnita Rao\t9812345678\tanita@example.com\tWEBSITE\tNEW\t12000000\tPraveen',
  },
];
