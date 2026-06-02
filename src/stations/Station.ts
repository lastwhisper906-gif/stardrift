export enum Station {
  Helm = 'Helm',
  Throttle = 'Throttle',
  Vertical = 'Vertical',
  Attack = 'Attack',
  Defense = 'Defense',
  Intercept = 'Intercept',
  Repair = 'Repair',
  SubPilot = 'SubPilot',
  Observer = 'Observer',
  DockingAlign = 'DockingAlign',
  Climber = 'Climber',
}

export const ALL_STATIONS: Station[] = Object.values(Station)
