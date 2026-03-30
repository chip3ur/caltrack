export interface TemplateExercise {
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes?: string
}

export interface TrainingTemplate {
  id: string
  name: string
  description: string
  level: 'débutant' | 'intermédiaire' | 'avancé'
  days: { day: number; label: string; exercises: TemplateExercise[] }[]
}

export const TRAINING_TEMPLATES: TrainingTemplate[] = [
  {
    id: 'full-body-3j',
    name: 'Full Body 3 jours',
    description: 'Programme complet pour travailler tout le corps 3 fois par semaine',
    level: 'débutant',
    days: [
      {
        day: 1, label: 'Lundi',
        exercises: [
          { name: 'Squat', sets: 3, reps: '10', rest_seconds: 90 },
          { name: 'Développé couché', sets: 3, reps: '10', rest_seconds: 90 },
          { name: 'Rowing barre', sets: 3, reps: '10', rest_seconds: 90 },
          { name: 'Gainage', sets: 3, reps: '30s', rest_seconds: 60 },
        ]
      },
      {
        day: 2, label: 'Mercredi',
        exercises: [
          { name: 'Soulevé de terre', sets: 3, reps: '8', rest_seconds: 120 },
          { name: 'Développé militaire', sets: 3, reps: '10', rest_seconds: 90 },
          { name: 'Tractions', sets: 3, reps: '6-8', rest_seconds: 90, notes: 'Bandes élastiques si besoin' },
          { name: 'Fentes', sets: 3, reps: '10/jambe', rest_seconds: 60 },
        ]
      },
      {
        day: 3, label: 'Vendredi',
        exercises: [
          { name: 'Squat', sets: 4, reps: '8', rest_seconds: 120 },
          { name: 'Développé couché', sets: 4, reps: '8', rest_seconds: 90 },
          { name: 'Rowing barre', sets: 4, reps: '8', rest_seconds: 90 },
          { name: 'Gainage', sets: 3, reps: '45s', rest_seconds: 60 },
        ]
      },
    ]
  },
  {
    id: 'ppl-6j',
    name: 'Push / Pull / Legs',
    description: 'Programme 6 jours pour maximiser la progression musculaire',
    level: 'intermédiaire',
    days: [
      {
        day: 1, label: 'Push (poussée)',
        exercises: [
          { name: 'Développé couché', sets: 4, reps: '8', rest_seconds: 120 },
          { name: 'Développé militaire', sets: 4, reps: '10', rest_seconds: 90 },
          { name: 'Gainage', sets: 3, reps: '60s', rest_seconds: 60 },
        ]
      },
      {
        day: 2, label: 'Pull (tirage)',
        exercises: [
          { name: 'Soulevé de terre', sets: 4, reps: '6', rest_seconds: 180 },
          { name: 'Rowing barre', sets: 4, reps: '8', rest_seconds: 120 },
          { name: 'Tractions', sets: 4, reps: '6-8', rest_seconds: 120 },
        ]
      },
      {
        day: 3, label: 'Legs (jambes)',
        exercises: [
          { name: 'Squat', sets: 4, reps: '8', rest_seconds: 180 },
          { name: 'Fentes', sets: 3, reps: '10/jambe', rest_seconds: 90 },
        ]
      },
      {
        day: 4, label: 'Push (répétition)',
        exercises: [
          { name: 'Développé couché', sets: 4, reps: '10', rest_seconds: 90 },
          { name: 'Développé militaire', sets: 3, reps: '12', rest_seconds: 90 },
        ]
      },
      {
        day: 5, label: 'Pull (répétition)',
        exercises: [
          { name: 'Rowing barre', sets: 4, reps: '10', rest_seconds: 90 },
          { name: 'Tractions', sets: 4, reps: '8', rest_seconds: 120 },
        ]
      },
      {
        day: 6, label: 'Legs (répétition)',
        exercises: [
          { name: 'Squat', sets: 4, reps: '10', rest_seconds: 120 },
          { name: 'Soulevé de terre', sets: 3, reps: '8', rest_seconds: 150 },
          { name: 'Fentes', sets: 3, reps: '12/jambe', rest_seconds: 60 },
        ]
      },
    ]
  },
  {
    id: 'cardio-force',
    name: 'Cardio + Force',
    description: 'Mélange de cardio et musculation pour améliorer la forme générale',
    level: 'débutant',
    days: [
      {
        day: 1, label: 'Force',
        exercises: [
          { name: 'Squat', sets: 3, reps: '12', rest_seconds: 90 },
          { name: 'Développé couché', sets: 3, reps: '12', rest_seconds: 90 },
          { name: 'Rowing barre', sets: 3, reps: '12', rest_seconds: 90 },
        ]
      },
      {
        day: 2, label: 'Cardio',
        exercises: [
          { name: 'Course', sets: 1, reps: '30min', rest_seconds: 0, notes: 'Allure modérée, zone 2' },
          { name: 'Burpees', sets: 4, reps: '10', rest_seconds: 60 },
          { name: 'Gainage', sets: 3, reps: '45s', rest_seconds: 45 },
        ]
      },
      {
        day: 3, label: 'Force + Cardio',
        exercises: [
          { name: 'Soulevé de terre', sets: 3, reps: '10', rest_seconds: 120 },
          { name: 'Fentes', sets: 3, reps: '10/jambe', rest_seconds: 60 },
          { name: 'Burpees', sets: 3, reps: '10', rest_seconds: 60 },
          { name: 'Course', sets: 1, reps: '15min', rest_seconds: 0, notes: 'Finisher cardio' },
        ]
      },
    ]
  },
]
