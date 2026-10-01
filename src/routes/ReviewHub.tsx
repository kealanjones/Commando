import { Link } from 'react-router-dom';
import { useTasks } from '@/data/store';
import { useReviewStatus } from '@/data/review';
import { undated } from '@/lib/plan';

/**
 * The two jobs that keep the register honest, side by side:
 * decide what has gone stale, and give undated items a day.
 */
export function ReviewHub() {
  const review = useReviewStatus();
  const { data: tasks = [] } = useTasks();
  const toPlace = undated(tasks).length;

  const reasons = [
    review.reasons.overdue && `${review.reasons.overdue} overdue`,
    review.reasons.unfinishable && `${review.reasons.unfinishable} with no finish line`,
    review.reasons.urgent_undated && `${review.reasons.urgent_undated} urgent but undated`,
    review.reasons.stale && `${review.reasons.stale} gone quiet`,
  ].filter(Boolean).join(' · ');

  return (
    <section aria-labelledby="review-head">
      <div className="shead">
        <h2 id="review-head">Review</h2>
      </div>

      <ul className="list">
        <li>
          <Link to="/review/decide" className="hub">
            <span className="hub__n">{review.session}</span>
            <span className="hub__body">
              <b>Weekly review</b>
              <span>
                {review.waiting === 0
                  ? 'Nothing needs a decision. Come back next week.'
                  : `${review.session} to decide, one at a time — ${reasons}.`}
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link to="/review/plan" className="hub">
            <span className="hub__n">{toPlace}</span>
            <span className="hub__body">
              <b>Plan</b>
              <span>
                {toPlace === 0
                  ? 'Everything open has a date.'
                  : `${toPlace} open ${toPlace === 1 ? 'item has' : 'items have'} no date. Give them a day against a calendar of how busy each day already is.`}
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
