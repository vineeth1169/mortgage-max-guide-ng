export interface NavigationItem {
  id: string;
  title: string;
  children?: NavigationItem[];
}

export interface GuideSection {
  id: string;
  title: string;
  effectiveDate: string;
  breadcrumbs: BreadcrumbItem[];
  contentHtml: string;
  tableData?: TableData;
}

export interface BreadcrumbItem {
  label: string;
  sectionId?: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface Bulletin {
  id: string;
  title: string;
  date: string;
  pdfUrl: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface RelatedResources {
  bulletins: Bulletin[];
  faqs: FAQ[];
  forms: FormLink[];
}

export interface FormLink {
  id: string;
  title: string;
  formNumber: string;
  url: string;
}
