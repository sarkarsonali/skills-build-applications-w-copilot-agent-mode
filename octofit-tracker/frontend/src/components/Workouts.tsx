import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type Workout = { title: string; reason?: string; focus?: string; minutes?: number; difficulty?: string };
type WorkoutResponse = { suggestions: Workout[] };

export default function Workouts() {
  const [suggestions, setSuggestions] = useState<Workout[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const userEmail = 'mona@example.com';
    getJson<WorkoutResponse>(`/api/workouts/suggestions/${encodeURIComponent(userEmail)}`)
      .then(({ suggestions: result }) => {
        if (active) setSuggestions(result);
      })
      .catch(() => {
        if (active) setHasError(true);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">Workout suggestions</h2>
        <p>Recommend workouts from activity patterns.</p>
        {hasError ? (
          <p role="alert">Unable to load workout suggestions.</p>
        ) : suggestions === null ? (
          <p role="status">Loading workout suggestions...</p>
        ) : suggestions.length === 0 ? (
          <p>No workout suggestions yet.</p>
        ) : (
          <ul className="list-group list-group-flush">
            {suggestions.map((workout, index) => (
              <li className="list-group-item px-0" key={`${workout.title}-${index}`}>
                <strong>{workout.title}</strong>
                {workout.focus ? ` · ${workout.focus}` : ''}
                {workout.minutes ? ` · ${workout.minutes} min` : ''}
                {workout.difficulty ? ` · ${workout.difficulty}` : ''}
                {workout.reason ? <span className="d-block text-body-secondary">{workout.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
