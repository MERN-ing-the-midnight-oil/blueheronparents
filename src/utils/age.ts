export function getAgeLabel(options: {
    birthYear?: number | string | null;
    birthMonth?: number | string | null;
    fallbackAge?: string;
}): string {
    const { birthYear, birthMonth, fallbackAge } = options;

    const yearNumber =
        typeof birthYear === 'string'
            ? parseInt(birthYear, 10)
            : typeof birthYear === 'number'
            ? birthYear
            : undefined;

    const monthNumber =
        typeof birthMonth === 'string'
            ? parseInt(birthMonth, 10)
            : typeof birthMonth === 'number'
            ? birthMonth
            : undefined;

    if (
        typeof yearNumber !== 'number' ||
        Number.isNaN(yearNumber) ||
        typeof monthNumber !== 'number' ||
        Number.isNaN(monthNumber)
    ) {
        return fallbackAge || 'Age not provided';
    }

    const currentDate = new Date();
    const birthDate = new Date(yearNumber, Math.max(0, monthNumber - 1), 1);

    if (birthDate > currentDate) {
        return fallbackAge || 'Age not provided';
    }

    let years = currentDate.getFullYear() - yearNumber;
    let months = currentDate.getMonth() - (monthNumber - 1);

    if (months < 0) {
        years -= 1;
        months += 12;
    }

    if (years < 0) {
        return fallbackAge || 'Age not provided';
    }

    const yearLabel =
        years > 0 ? `${years} year${years === 1 ? '' : 's'}` : undefined;
    const monthLabel =
        months > 0 ? `${months} month${months === 1 ? '' : 's'}` : undefined;

    const parts = [yearLabel, monthLabel].filter(Boolean);

    if (parts.length === 0) {
        return 'Less than one month old';
    }

    return `${parts.join(' ')} old`;
}

