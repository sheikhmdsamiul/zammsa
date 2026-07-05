import { ProcurementMilestone } from '../types';

/** SRS BR-SOL-01 / BR-CPP-08: minimum calendar days from publication to closing */
export const MIN_SOLICITATION_PERIODS: Record<string, number> = {
  open_tender: 21,
  international: 30,
  limited: 14,
  simplified: 14,
  direct: 0,
};

/** Days from CPP approval to solicitation publication (SRS: requisition to solicitation) */
export const PUBLICATION_OFFSET_DAYS: Record<string, number> = {
  open_tender: 3,
  international: 10,
  limited: 3,
  simplified: 2,
  direct: 2,
};

export interface MilestoneTemplate {
  name: string;
  locked: boolean;
  autoCalculated: boolean;
  daysFromToday?: number;
  daysFromPublished?: number;
  daysAfterClosing?: number;
  time?: string;
  note?: string;
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  if (days >= 0) {
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) added++;
    }
  } else {
    let subtracted = 0;
    while (subtracted > days) {
      result.setDate(result.getDate() - 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) subtracted--;
    }
  }
  return result;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isPublicationMilestone(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('solicitation published') || lower.includes('solicitation issued');
}

function isClosingMilestone(name: string): boolean {
  const lower = name.toLowerCase();
  return (lower.includes('bid closing') || lower.includes('closing date'))
    && !lower.includes('clarification');
}

function isOpeningMilestone(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('bid opening') || lower.includes('public bid opening');
}

function isClarificationMilestone(name: string): boolean {
  return name.toLowerCase().includes('clarification');
}

function isStandstillMilestone(name: string): boolean {
  return name.toLowerCase().includes('standstill');
}

function isAwardMilestone(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('award notice') || lower.includes('contract award');
}

function isDocumentReadyMilestone(name: string): boolean {
  return name.toLowerCase().includes('document ready');
}

function isDeliveryMilestone(name: string): boolean {
  return name.toLowerCase().includes('delivery');
}

/**
 * Build Strategy Milestone planned dates per SRS §5.9.2:
 * - Publication = CPP approval + requisition-to-solicitation days
 * - Closing = publication + minimum solicitation period (calendar days)
 * - Opening = same day as closing (time handled separately)
 * - Downstream milestones offset from closing
 */
export function buildCppMilestoneDates(
  method: string,
  template: MilestoneTemplate[],
  options: {
    startDate?: Date;
    deliveryDate?: Date;
    minPeriod?: number;
  } = {},
): ProcurementMilestone[] {
  const today = options.startDate ? new Date(options.startDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const minPeriod = options.minPeriod ?? MIN_SOLICITATION_PERIODS[method] ?? 21;
  const publicationOffset = PUBLICATION_OFFSET_DAYS[method] ?? 3;
  const deliveryDate = options.deliveryDate
    ? new Date(options.deliveryDate)
    : addWorkingDays(today, 75);

  const publishedDate = addCalendarDays(today, publicationOffset);
  const closingDate = minPeriod > 0
    ? addCalendarDays(publishedDate, minPeriod)
    : publishedDate;
  const openingDate = new Date(closingDate);

  const generated: ProcurementMilestone[] = template.map((t, idx) => {
    let planned: Date;
    const name = t.name;

    if (t.locked && t.note?.includes('today')) {
      planned = today;
    } else if (isDeliveryMilestone(name)) {
      planned = deliveryDate;
    } else if (isDocumentReadyMilestone(name)) {
      planned = addCalendarDays(today, Math.max(1, publicationOffset - 1));
    } else if (isPublicationMilestone(name)) {
      planned = publishedDate;
    } else if (isClosingMilestone(name)) {
      planned = closingDate;
    } else if (isOpeningMilestone(name)) {
      planned = openingDate;
    } else if (isClarificationMilestone(name)) {
      planned = addWorkingDays(closingDate, -5);
    } else if (isStandstillMilestone(name)) {
      // Filled in second pass once award date is known
      planned = addCalendarDays(closingDate, 31);
    } else if (t.daysAfterClosing !== undefined) {
      planned = addCalendarDays(closingDate, t.daysAfterClosing);
    } else if (t.daysFromPublished !== undefined) {
      planned = addCalendarDays(publishedDate, t.daysFromPublished);
    } else if (t.daysFromToday !== undefined) {
      planned = addCalendarDays(today, t.daysFromToday);
    } else {
      planned = addCalendarDays(today, (idx + 1) * 2);
    }

    let constraintNote = '';
    if (isPublicationMilestone(name)) {
      constraintNote = `must be ≥ today (drives solicitation period start)`;
    } else if (isClosingMilestone(name)) {
      constraintNote = `min ${minPeriod} calendar days from publication (BR-SOL-01)`;
    } else if (isOpeningMilestone(name)) {
      constraintNote = 'same day or after closing (SRS §8.7.1 Step 6)';
    } else if (isDocumentReadyMilestone(name)) {
      constraintNote = '1 day before publication';
    } else if (isClarificationMilestone(name)) {
      constraintNote = 'closing minus 5 working days (BR-SOL-02)';
    } else if (isStandstillMilestone(name)) {
      constraintNote = 'award notice + 10 working days';
    } else if (isAwardMilestone(name)) {
      constraintNote = 'after BER/ZPC approval';
    } else if (isDeliveryMilestone(name)) {
      constraintNote = 'from requisition required date';
    }

    const validationBadges: string[] = [];
    if (isPublicationMilestone(name)) validationBadges.push('days_to_closing');
    if (isDeliveryMilestone(name)) validationBadges.push('achievable');

    return {
      milestone_id: crypto.randomUUID(),
      cpp: '',
      milestone_name: name,
      sequence_number: idx + 1,
      planned_date: formatDate(planned),
      actual_date: null,
      variance_days: null,
      variance_flag: t.locked ? 'green' : undefined,
      is_system_updated: t.autoCalculated,
      time: t.time,
      note: t.note,
      constraintNote,
      validationBadges,
    };
  });

  const award = generated.find((m) => isAwardMilestone(m.milestone_name));
  const standstill = generated.find((m) => isStandstillMilestone(m.milestone_name));
  if (award && standstill) {
    standstill.planned_date = formatDate(
      addWorkingDays(new Date(award.planned_date), 10),
    );
  }

  return generated;
}

export function recalculateDependentMilestones(
  milestones: ProcurementMilestone[],
): ProcurementMilestone[] {
  const closing = milestones.find((m) => isClosingMilestone(m.milestone_name));
  const award = milestones.find((m) => isAwardMilestone(m.milestone_name));

  return milestones.map((m) => {
    if (isClarificationMilestone(m.milestone_name) && closing) {
      try {
        return {
          ...m,
          planned_date: formatDate(addWorkingDays(new Date(closing.planned_date), -5)),
        };
      } catch {
        return m;
      }
    }
    if (isStandstillMilestone(m.milestone_name) && award) {
      try {
        return {
          ...m,
          planned_date: formatDate(addWorkingDays(new Date(award.planned_date), 10)),
        };
      } catch {
        return m;
      }
    }
    return m;
  });
}

function isZpcApprovalMilestone(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('zpc approval') || lower.includes('ber approved by zpc');
}

export function validateCppMilestoneDates(
  milestones: ProcurementMilestone[],
  method: string,
  minPeriod?: number,
  options: { requisitionDeliveryDate?: string } = {},
): string[] {
  const errors: string[] = [];
  const period = minPeriod ?? MIN_SOLICITATION_PERIODS[method] ?? 21;

  const pub = milestones.find((m) => isPublicationMilestone(m.milestone_name));
  const closing = milestones.find((m) => isClosingMilestone(m.milestone_name));
  const opening = milestones.find((m) => isOpeningMilestone(m.milestone_name));
  const award = milestones.find((m) => isAwardMilestone(m.milestone_name));
  const zpc = milestones.find((m) => isZpcApprovalMilestone(m.milestone_name));
  const standstill = milestones.find((m) => isStandstillMilestone(m.milestone_name));
  const delivery = milestones.find((m) => isDeliveryMilestone(m.milestone_name));

  // 1. Solicitation period validation
  if (pub && closing && period > 0) {
    const pubDate = new Date(pub.planned_date);
    const closingDate = new Date(closing.planned_date);
    const daysDiff = Math.round(
      (closingDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff < period) {
      errors.push(
        `Solicitation period (${daysDiff} days) is less than minimum (${period} calendar days) for method ${method.toUpperCase()}`,
      );
    }
  }

  // 2. Bid opening on or after closing
  if (opening && closing) {
    const openDate = new Date(opening.planned_date);
    const closeDate = new Date(closing.planned_date);
    if (openDate < closeDate) {
      errors.push('Bid opening date must be on or after bid closing date');
    }
  }

  // 3. Award notice after ZPC/BER approval
  if (award && zpc) {
    const awardDate = new Date(award.planned_date);
    const zpcDate = new Date(zpc.planned_date);
    if (awardDate < zpcDate) {
      errors.push('Contract award notice publication must be on or after ZPC/BER approval date');
    }
  }

  // 4. Standstill period validation (min 10 working days after award notice)
  if (standstill && award) {
    const standDate = new Date(standstill.planned_date);
    const awardDate = new Date(award.planned_date);
    const expectedStandDate = addWorkingDays(awardDate, 10);
    if (standDate < expectedStandDate) {
      errors.push(
        `Standstill period ends date (${standstill.planned_date}) is earlier than minimum 10 working days after award notice (${formatDate(expectedStandDate)})`,
      );
    }
  }

  // 5. Requisition delivery date compliance
  if (delivery && options?.requisitionDeliveryDate) {
    const plannedDelivery = new Date(delivery.planned_date);
    const requiredDelivery = new Date(options.requisitionDeliveryDate);
    if (plannedDelivery > requiredDelivery) {
      errors.push(
        `Planned delivery date (${delivery.planned_date}) exceeds requisition required date (${options.requisitionDeliveryDate})`,
      );
    }
  }

  // 6. Chronological sequence validation (check that successive milestones don't go backwards)
  const sorted = [...milestones].sort((a, b) => a.sequence_number - b.sequence_number);
  for (let j = 1; j < sorted.length; j++) {
    const prev = sorted[j - 1];
    const curr = sorted[j];
    if (prev.planned_date && curr.planned_date) {
      const prevDate = new Date(prev.planned_date);
      const currDate = new Date(curr.planned_date);
      if (currDate < prevDate) {
        errors.push(
          `Milestone "${curr.milestone_name}" (${curr.planned_date}) is scheduled before preceding milestone "${prev.milestone_name}" (${prev.planned_date})`,
        );
      }
    }
  }

  return errors;
}
