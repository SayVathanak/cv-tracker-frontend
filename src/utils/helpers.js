export const getUserFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch (e) {
    return null;
  }
}

export const formatDOB = (dateString) => {
  if (!dateString || dateString === "N/A") return "N/A"
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [_, year, month, day] = isoMatch
    const monthName = months[parseInt(month) - 1]
    return `${day}-${monthName}-${year}`
  }
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  const d = String(date.getDate()).padStart(2, '0')
  const m = months[date.getMonth()]
  const y = date.getFullYear()
  return `${d}-${m}-${y}`
}