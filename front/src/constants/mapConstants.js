export const MONTH_OPTIONS = [
  { value: "01", label: "January" }, { value: "02", label: "February" },
  { value: "03", label: "March" },   { value: "04", label: "April" },
  { value: "05", label: "May" },     { value: "06", label: "June" },
  { value: "07", label: "July" },    { value: "08", label: "August" },
  { value: "09", label: "September"},{ value: "10", label: "October" },
  { value: "11", label: "November"}, { value: "12", label: "December" },
];

export const LEVELS_LIST = [
  { name: "Pathfinder",       min: 0,  next: 5  },
  { name: "Explorer",         min: 5,  next: 10 },
  { name: "Adventurer",       min: 10, next: 20 },
  { name: "Voyager",          min: 20, next: 35 },
  { name: "Globetrotter",     min: 35, next: 50 },
  { name: "Legendary Nomad",  min: 50, next: null },
];