export interface ElectionPartyResult {
  id: string;
  shortName: string;
  fullName: string;
  percent: number;
  delta: number | 'neu';
  seats: number;
}

export interface ElectionDataset {
  title: string;
  electionDate: string;
  results: ElectionPartyResult[];
  totalSeats: number;
  majoritySeats: number;
}

export const currentStateElection: ElectionDataset = {
  title: 'Wahl zum Landtag 2026',
  electionDate: '2026-04-19',
  results: [
    {
      id: 'vf',
      shortName: 'VF',
      fullName: 'Vereinte Fortschrittspartei',
      percent: 34.69,
      delta: 2.29,
      seats: 5,
    },
    {
      id: 'demos',
      shortName: 'DEMOS',
      fullName: 'Demokratische Mitte Ostdeutschlands',
      percent: 24.49,
      delta: -5.21,
      seats: 4,
    },
    {
      id: 'frp',
      shortName: 'FRP',
      fullName: 'Freie Reformpartei',
      percent: 16.33,
      delta: -21.47,
      seats: 3,
    },
    {
      id: 'patrioten',
      shortName: 'PATRIOTEN',
      fullName: 'Patrioten',
      percent: 14.29,
      delta: 'neu',
      seats: 2,
    },
    {
      id: 'cdp',
      shortName: 'CDP',
      fullName: 'Christlich-Demokratische Partei',
      percent: 10.2,
      delta: 'neu',
      seats: 1,
    },
  ],
  totalSeats: 15,
  majoritySeats: 8,
};
