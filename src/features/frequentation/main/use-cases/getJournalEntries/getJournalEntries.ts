import type { FrequentationGateway } from '@frequentation/gateways/frequentation'
import type { StudentGateway } from '@student/gateways/student'
import type { DateRangeDto, JournalEntryDto } from '@frequentation-shared'
import type { UseCaseResult } from '@lib/use-case'
import { formatFrequentationResponse } from '../helpers/formatFrequentationResponse'

export async function getJournalEntries(
  frequentationGateway: FrequentationGateway,
  _studentGateway: StudentGateway,
  dateRange: DateRangeDto
): Promise<UseCaseResult<JournalEntryDto[]>> {
  try {
    const frequentations = await frequentationGateway.getByDateRange(
      dateRange.startDate,
      dateRange.endDate
    )

    const entries: JournalEntryDto[] = []

    for (const frequentation of frequentations) {
      entries.push({
        frequentation: formatFrequentationResponse(frequentation),
        student:
          frequentation.studentId === null ||
          frequentation.studentNom === null ||
          frequentation.studentPrenom === null
            ? null
            : {
                id: frequentation.studentId,
                nom: frequentation.studentNom,
                prenom: frequentation.studentPrenom,
                classe: frequentation.studentClasse,
                ine: frequentation.studentIne ?? ''
              }
      })
    }

    return { success: true, data: entries }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
