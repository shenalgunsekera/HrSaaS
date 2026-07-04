/**
 * Employee Master starter template — transcribed directly from
 * `HR_System_Feature_Sheets_v5`, module "Employee Master", lettered groups
 * A–K. This is the proof-pattern for feature-sheet → template generation;
 * the remaining modules are transcribed the same way in Phase 4.
 *
 * Note: statutory-critical fields (payroll amounts, EPF/ETF numbers) exist
 * here as TEMPLATE metadata for form layout only — their storage is the
 * fixed typed core schema, not JSONB (non-negotiable #4).
 */
import type { ObjectDefinition } from '../types';

export const employeeMasterTemplate: ObjectDefinition = {
  key: 'employee',
  label: 'Employee Master',
  icon: 'id-card',
  kind: 'core-extension',
  extendsCore: 'employee',
  moduleKey: 'employee-master',
  version: 1,
  status: 'published',
  sections: [
    { key: 'employee-information', label: 'A. Employee Information', displayOrder: 1 },
    { key: 'contact-information', label: 'B. Contact Information', displayOrder: 2 },
    { key: 'employment-details', label: 'C. Employment Details', displayOrder: 3 },
    { key: 'payroll-information', label: 'D. Payroll Information', displayOrder: 4 },
    { key: 'statutory-information', label: 'E. Statutory Information (Sri Lanka)', displayOrder: 5 },
    { key: 'documents', label: 'F. Documents', displayOrder: 6 },
    { key: 'employee-status', label: 'G. Employee Status', displayOrder: 7 },
    { key: 'assets-issued', label: 'H. Assets Issued', displayOrder: 8 },
    { key: 'organization-structure', label: 'I. Organization Structure', displayOrder: 9 },
  ],
  fields: [
    // A. Employee Information
    { key: 'employee_number', label: 'Employee Number', type: 'text', sectionKey: 'employee-information', displayOrder: 1, helpText: 'Auto-generated', validation: { required: true } },
    { key: 'employee_code', label: 'Employee Code', type: 'text', sectionKey: 'employee-information', displayOrder: 2 },
    { key: 'title', label: 'Title', type: 'singleSelect', sectionKey: 'employee-information', displayOrder: 3, validation: { options: ['Mr', 'Mrs', 'Ms', 'Dr', 'Rev'] } },
    { key: 'full_name', label: 'Full Name', type: 'text', sectionKey: 'employee-information', displayOrder: 4, validation: { required: true } },
    { key: 'preferred_name', label: 'Preferred Name', type: 'text', sectionKey: 'employee-information', displayOrder: 5 },
    { key: 'gender', label: 'Gender', type: 'singleSelect', sectionKey: 'employee-information', displayOrder: 6, validation: { options: ['Male', 'Female', 'Other'] } },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date', sectionKey: 'employee-information', displayOrder: 7 },
    { key: 'national_id', label: 'National ID / Passport', type: 'text', sectionKey: 'employee-information', displayOrder: 8, validation: { required: true } },
    { key: 'photograph', label: 'Photograph', type: 'file', sectionKey: 'employee-information', displayOrder: 9, validation: { fileTypes: ['image/jpeg', 'image/png'], maxFileSizeMb: 5 } },
    { key: 'marital_status', label: 'Marital Status', type: 'singleSelect', sectionKey: 'employee-information', displayOrder: 10, validation: { options: ['Single', 'Married', 'Widowed', 'Divorced'] } },
    { key: 'nationality', label: 'Nationality', type: 'text', sectionKey: 'employee-information', displayOrder: 11 },
    // B. Contact Information
    { key: 'permanent_address', label: 'Permanent Address', type: 'longText', sectionKey: 'contact-information', displayOrder: 1 },
    { key: 'current_address', label: 'Current Address', type: 'longText', sectionKey: 'contact-information', displayOrder: 2 },
    { key: 'mobile_number', label: 'Mobile Number', type: 'text', sectionKey: 'contact-information', displayOrder: 3, validation: { pattern: '^\\+?[0-9]{9,15}$' } },
    { key: 'telephone', label: 'Telephone', type: 'text', sectionKey: 'contact-information', displayOrder: 4 },
    { key: 'email_address', label: 'Email Address', type: 'text', sectionKey: 'contact-information', displayOrder: 5, validation: { pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' } },
    { key: 'emergency_contact', label: 'Emergency Contact', type: 'text', sectionKey: 'contact-information', displayOrder: 6 },
    { key: 'emergency_contact_number', label: 'Emergency Contact Number', type: 'text', sectionKey: 'contact-information', displayOrder: 7 },
    // C. Employment Details
    { key: 'date_joined', label: 'Date Joined', type: 'date', sectionKey: 'employment-details', displayOrder: 1, validation: { required: true } },
    { key: 'confirmation_date', label: 'Confirmation Date', type: 'date', sectionKey: 'employment-details', displayOrder: 2 },
    { key: 'employment_status', label: 'Employment Status', type: 'singleSelect', sectionKey: 'employment-details', displayOrder: 3, validation: { options: ['Permanent', 'Contract', 'Casual', 'Probation', 'Part-time'] } },
    { key: 'employee_category', label: 'Employee Category', type: 'singleSelect', sectionKey: 'employment-details', displayOrder: 4, validation: { options: ['Staff', 'Executive', 'Management'] } },
    { key: 'department', label: 'Department', type: 'lookup', sectionKey: 'employment-details', displayOrder: 5, validation: { lookupObject: 'department' } },
    { key: 'branch', label: 'Branch', type: 'lookup', sectionKey: 'employment-details', displayOrder: 6, validation: { lookupObject: 'branch' } },
    { key: 'cost_centre', label: 'Cost Centre', type: 'lookup', sectionKey: 'employment-details', displayOrder: 7, validation: { lookupObject: 'cost-centre' } },
    { key: 'designation', label: 'Designation', type: 'text', sectionKey: 'employment-details', displayOrder: 8 },
    { key: 'reporting_manager', label: 'Reporting Manager', type: 'lookup', sectionKey: 'employment-details', displayOrder: 9, validation: { lookupObject: 'employee' } },
    // D. Payroll Information (layout metadata; storage is typed core)
    { key: 'basic_salary', label: 'Basic Salary', type: 'currency', sectionKey: 'payroll-information', displayOrder: 1, visibleToRoles: ['hr', 'payroll-admin', 'tenant-admin'], editableByRoles: ['payroll-admin'] },
    { key: 'salary_grade', label: 'Salary Grade', type: 'lookup', sectionKey: 'payroll-information', displayOrder: 2, validation: { lookupObject: 'salary-grade' }, visibleToRoles: ['hr', 'payroll-admin', 'tenant-admin'] },
    { key: 'payment_method', label: 'Payment Method', type: 'singleSelect', sectionKey: 'payroll-information', displayOrder: 3, validation: { options: ['Bank', 'Cash'] }, visibleToRoles: ['hr', 'payroll-admin', 'tenant-admin'] },
    { key: 'bank_name', label: 'Bank Name', type: 'text', sectionKey: 'payroll-information', displayOrder: 4, visibleToRoles: ['payroll-admin', 'tenant-admin'] },
    { key: 'bank_branch', label: 'Bank Branch', type: 'text', sectionKey: 'payroll-information', displayOrder: 5, visibleToRoles: ['payroll-admin', 'tenant-admin'] },
    { key: 'account_number', label: 'Account Number', type: 'text', sectionKey: 'payroll-information', displayOrder: 6, visibleToRoles: ['payroll-admin', 'tenant-admin'] },
    // E. Statutory Information (Sri Lanka)
    { key: 'epf_number', label: 'EPF Number', type: 'text', sectionKey: 'statutory-information', displayOrder: 1, visibleToRoles: ['hr', 'payroll-admin', 'tenant-admin'] },
    { key: 'etf_number', label: 'ETF Number', type: 'text', sectionKey: 'statutory-information', displayOrder: 2, visibleToRoles: ['hr', 'payroll-admin', 'tenant-admin'] },
    { key: 'tax_identification_number', label: 'Tax Identification Number', type: 'text', sectionKey: 'statutory-information', displayOrder: 3, helpText: 'If applicable', visibleToRoles: ['hr', 'payroll-admin', 'tenant-admin'] },
    // F. Documents
    { key: 'documents', label: 'Documents', type: 'file', sectionKey: 'documents', displayOrder: 1, helpText: 'NIC, Appointment Letter, Employment Contract, Educational Certificates, Professional Qualifications, Driving Licence, Passport, Birth Certificate, Medical Reports, Other' },
    // G. Employee Status
    { key: 'employee_status', label: 'Employee Status', type: 'singleSelect', sectionKey: 'employee-status', displayOrder: 1, validation: { options: ['Active', 'On Leave', 'Suspended', 'Resigned', 'Retired', 'Deceased', 'Terminated'] } },
    // H. Assets Issued
    { key: 'assets_issued', label: 'Assets Issued', type: 'multiSelect', sectionKey: 'assets-issued', displayOrder: 1, validation: { options: ['Laptop', 'Desktop', 'Mobile Phone', 'Vehicle', 'Access Card', 'Keys', 'Uniform', 'SIM Card', 'Other Company Assets'] } },
    // I. Organization Structure
    { key: 'company', label: 'Company', type: 'lookup', sectionKey: 'organization-structure', displayOrder: 1, validation: { lookupObject: 'company' } },
    { key: 'division', label: 'Division', type: 'lookup', sectionKey: 'organization-structure', displayOrder: 2, validation: { lookupObject: 'division' } },
    { key: 'section', label: 'Section', type: 'lookup', sectionKey: 'organization-structure', displayOrder: 3, validation: { lookupObject: 'section' } },
    { key: 'team', label: 'Team', type: 'lookup', sectionKey: 'organization-structure', displayOrder: 4, validation: { lookupObject: 'team' } },
    { key: 'supervisor', label: 'Supervisor', type: 'lookup', sectionKey: 'organization-structure', displayOrder: 5, validation: { lookupObject: 'employee' } },
  ],
};
