import type { ReactNode } from "react"
import type { ChartMark } from "../../chart/marks.ts"
import { plotBottom, plotLeft, plotRight, plotTop, priceAxisX } from "../../chart/geometry.ts"

function PriceChartMarks({ marks }: { marks: readonly ChartMark[] }): ReactNode {
  return (
    <>
      {marks.map((mark, index) => {
        if (mark.kind === "frame") {
          return (
            <g key={`frame-${index}`}>
              <rect
                data-axis="background"
                x={plotLeft}
                y={plotTop}
                width={plotRight - plotLeft}
                height={plotBottom - plotTop}
                fill="#e8eef7"
                pointerEvents="none"
              />
              <path
                data-axis="grid"
                d={`${mark.horizontal} ${mark.vertical}`}
                fill="none"
                stroke="#c5d0de"
                strokeWidth="0.35"
                pointerEvents="none"
              />
              <path
                data-axis="x"
                d={`M${plotLeft} ${plotBottom} H${plotRight}`}
                fill="none"
                stroke="#334155"
                strokeWidth="0.6"
                pointerEvents="none"
              />
              <path
                data-axis="y"
                d={`M${priceAxisX} ${plotTop} V${plotBottom}`}
                fill="none"
                stroke="#334155"
                strokeWidth="0.6"
                pointerEvents="none"
              />
              {mark.xLabels.map((label) =>
                label.hidden ? null : (
                  <text
                    key={`x-${label.label}`}
                    data-axis="x"
                    x={label.x}
                    y={96}
                    fontSize={3.2}
                    fill="#334155"
                    textAnchor="middle"
                  >
                    {label.label}
                  </text>
                ),
              )}
              {mark.yLabels.map((label) => (
                <text
                  key={`y-${label.price}`}
                  data-axis="y"
                  x={priceAxisX + 2}
                  y={label.y}
                  fontSize={3.2}
                  fill="#334155"
                  textAnchor="start"
                  dominantBaseline="middle"
                >
                  {label.text}
                </text>
              ))}
            </g>
          )
        }
        if (mark.kind === "segment") {
          return (
            <line
              key={`seg-${mark.hit ? "hit" : "line"}-${mark.code}-${mark.fromDate}-${mark.toDate}-${index}`}
              data-code={mark.code}
              data-from-date={mark.fromDate}
              data-from-price={mark.fromPrice}
              data-to-date={mark.toDate}
              data-to-price={mark.toPrice}
              data-hit={mark.hit ? "true" : undefined}
              x1={mark.x1}
              y1={mark.y1}
              x2={mark.x2}
              y2={mark.y2}
              stroke={mark.paint}
              strokeWidth={mark.hit ? 6 : 0.6}
              strokeDasharray={mark.dashed ? "1 0.6" : undefined}
              fill="none"
              opacity={mark.opacity}
              pointerEvents={mark.hit ? "stroke" : "none"}
            />
          )
        }
        if (mark.kind === "point") {
          return (
            <circle
              key={`pt-${mark.code}-${mark.date}-${index}`}
              data-date={mark.date}
              data-price={mark.price}
              data-code={mark.code}
              data-delisted={mark.delisted ? "true" : undefined}
              cx={mark.x}
              cy={mark.y}
              r={mark.delisted ? 1 : 0.7}
              fill={mark.delisted ? "none" : mark.paint}
              stroke={mark.delisted ? mark.paint : undefined}
              strokeWidth={mark.delisted ? 0.4 : undefined}
              opacity={mark.opacity}
            />
          )
        }
        return (
          <text
            key={`label-${mark.code}`}
            data-series-label="true"
            data-code={mark.code}
            data-focused={mark.focused}
            x={mark.x}
            y={mark.y}
            fontSize={mark.fontSize}
            fill={mark.paint}
            opacity={mark.opacity}
            dominantBaseline="middle"
            style={{ cursor: "pointer" }}
          >
            {mark.code}
          </text>
        )
      })}
    </>
  )
}

function PriceChartSvg({
  marks,
  span,
  children,
}: {
  marks: readonly ChartMark[]
  span: { start: string; end: string } | null
  children?: ReactNode
}): ReactNode {
  return (
    <svg
      data-price-chart=""
      data-chart-start={span?.start}
      data-chart-end={span?.end}
      data-mode="fit"
      viewBox="0 0 400 100"
      width="100%"
      style={{ display: "block", width: "100%", height: "auto", aspectRatio: "4 / 1" }}
    >
      <PriceChartMarks marks={marks} />
      {children}
    </svg>
  )
}

export { PriceChartMarks, PriceChartSvg }
