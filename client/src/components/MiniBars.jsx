/**
 * The sprint pulse: tasks completed per day, drawn as columns.
 *
 * Chart rules this component follows: square-cornered columns in the
 * one data hue, 3 faint horizontal gridlines with round integer ticks,
 * 4 date labels, honest zeros (an empty day draws nothing), and no
 * axis chrome. The y-tick lane sits on the right.
 */
export default function MiniBars({ series }) {
  const counts = series.map((point) => point.count);
  const maxCount = Math.max(...counts, 1);

  // Round, even tick steps that land above the maximum.
  const step = Math.max(1, Math.ceil(maxCount / 3));
  const top = step * 3;
  const gridlines = [
    { value: step * 3, at: 0 },
    { value: step * 2, at: 33.333 },
    { value: step, at: 66.667 },
  ];

  // 4 date labels: first, two middles, last.
  const labelIndices = [0, 4, 9, series.length - 1]
    .filter((value, index, all) => value >= 0 && value < series.length && all.indexOf(value) === index);

  return (
    <div className="chart" role="img" aria-label={`Tasks completed per day over the last ${series.length} days`}>
      <div className="chart__grid" aria-hidden="true">
        {gridlines.map((line) => (
          <span key={line.value} style={{ top: `${line.at}%` }} />
        ))}
        {gridlines.map((line) => (
          <b key={line.value} style={{ top: `${line.at}%` }} className="num">{line.value}</b>
        ))}
      </div>
      <div className="chart__bars" aria-hidden="true">
        {series.map((point) => (
          <i
            key={point.date}
            style={point.count > 0 ? { height: `${(point.count / top) * 100}%` } : undefined}
            title={`${point.date}: ${point.count} completed`}
          />
        ))}
      </div>
      <div className="chart__labels" aria-hidden="true">
        {labelIndices.map((index) => (
          <span key={series[index].date} className="num">
            {new Date(`${series[index].date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  );
}
