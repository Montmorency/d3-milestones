import * as dom from 'd3-selection';
import { nest } from 'd3-collection';

import { cssLastClass } from './_css';
import { getAttribute } from './_get_attribute';
import { getAvailableWidth } from './_get_available_width';
import { getNextGroupHeight } from './_get_next_group_height';
import { isAbove } from './_is_above';

export const optimize = (
  aggregateFormatParse,
  distribution,
  labelMaxWidth,
  mapping,
  nestedData,
  orientation,
  textMerge,
  width,
  widthAttribute,
  x
) => {
  const nestedNodes = nest()
    .key((d) => {
      return dom.selectAll(d).data()[0].timelineIndex;
    })
    .entries(textMerge._groups);

  const nextCheck = distribution === 'top-bottom' ? 2 : 1;

  const runOptimizer = (optimizerRuns) => {
    let updated = false;

    nestedNodes.forEach((d) => {
      const nodes = d.values;
      nodes.forEach((node) => {
        const d = dom.selectAll(node).data()[0];

        const index =
          orientation === 'horizontal' ? nodes.length - d.index - 1 : d.index;

        const item = dom.selectAll(nodes[index]).data()[0];
        const offset = x(aggregateFormatParse(item.key));
        const currentNode = nodes[index][0];

        const scrollCheckAttribute =
          orientation === 'horizontal' ? 'offsetWidth' : 'offsetHeight';

        const offsetCheckAttribute =
          orientation === 'horizontal' ? 'width' : 'height';

        const offsetComparator = orientation === 'horizontal' ? 60 : 20;

        const offsetCheck = getAttribute(currentNode, offsetCheckAttribute);

        const domElement = dom.selectAll(nodes[index]);

        const backwards = domElement
          .select(function () {
            return this.parentNode;
          })
          .classed(cssLastClass);

        if (
          currentNode[scrollCheckAttribute] > offsetCheck ||
          offsetCheck < offsetComparator ||
          backwards
        ) {
          const paddingAbove =
            orientation === 'horizontal' ? 'padding-bottom' : 'padding-right';

          const paddingBelow =
            orientation === 'horizontal' ? 'padding-top' : 'padding-left';

          const padding = isAbove(index, distribution)
            ? paddingAbove
            : paddingBelow;

          const offsetAttribute =
            orientation === 'horizontal' ? 'offsetHeight' : 'offsetWidth';

          let availableWidth = 0;
          let runs = 0;
          let nextCheckIterator =
            orientation === 'horizontal' ? nextCheck - 1 : nextCheck + 1;

          do {
            if (orientation === 'horizontal') {
              nextCheckIterator++;
            } else {
              nextCheckIterator--;
            }

            runs++;

            if (nextCheckIterator > 0) {
              const nextGroupHeight = getNextGroupHeight(
                index,
                nextCheck,
                nodes,
                offsetAttribute,
                orientation
              );

              const previousGroupHeight =
                orientation === 'horizontal'
                  ? getNextGroupHeight(
                      index,
                      nextCheck * -1,
                      nodes,
                      offsetAttribute,
                      orientation
                    )
                  : nextGroupHeight;

              const useNext =
                nextGroupHeight <= previousGroupHeight &&
                nextGroupHeight !== undefined;

              const groupHeight = useNext
                ? nextGroupHeight
                : previousGroupHeight;
              const check = useNext ? nextCheck : nextCheck * -1;

              const existingGroupHeight = parseInt(
                domElement.style(padding).replace('px', ''),
                10
              );
              if (
                existingGroupHeight != groupHeight &&
                nextGroupHeight !== undefined
              ) {
                updated = true;
                domElement.style(padding, groupHeight + 'px');
              }

              domElement
                .select(function () {
                  return this.parentNode;
                })
                .classed(cssLastClass, !useNext);

              availableWidth = getAvailableWidth(
                aggregateFormatParse,
                currentNode,
                index,
                mapping,
                nestedData,
                d,
                check,
                groupHeight,
                offset,
                offsetCheckAttribute,
                offsetAttribute,
                orientation,
                textMerge,
                width,
                x,
                useNext
              );
            }
          } while (
            availableWidth < currentNode[scrollCheckAttribute] &&
            runs < 10
          );

          if (orientation === 'horizontal') {
            availableWidth = Math.min(labelMaxWidth, availableWidth);
          }

          domElement.style(widthAttribute, availableWidth + 'px');

          // After the first optimizer run,
          // reduce overlaps caused by left/right positioning
          if (optimizerRuns > 0 && backwards && orientation === 'horizontal') {
            const itemWidth = parseInt(
              domElement.style('width').replace('px', ''),
              10
            );
            const leftOffset = offset - itemWidth;

            nodes.forEach((overlapCheckNode, overlapCheckIndex) => {
              const itemRowCheck = index % nextCheck;
              const distributionCheck =
                (overlapCheckIndex + itemRowCheck) % nextCheck;

              const overlapCheckItem = dom
                .selectAll(overlapCheckNode)
                .data()[0];

              if (
                overlapCheckItem.key === item.key ||
                distributionCheck !== 0
              ) {
                return;
              }

              let overlapCheckOffset = x(
                aggregateFormatParse(overlapCheckItem.key)
              );
              const overlapItemOffsetAnchor = overlapCheckOffset;
              const overlapCheckDomElement = dom.selectAll(
                nodes[overlapCheckIndex]
              );
              const overlapCheckBackwards = overlapCheckDomElement
                .select(function () {
                  return this.parentNode;
                })
                .classed(cssLastClass);

              if (!overlapCheckBackwards) {
                const overlapCheckItemWidth = parseInt(
                  overlapCheckDomElement.style('width').replace('px', ''),
                  10
                );
                overlapCheckOffset =
                  overlapCheckOffset + overlapCheckItemWidth + 5;
              }

              if (
                overlapCheckOffset > leftOffset &&
                overlapItemOffsetAnchor < offset
              ) {
                const overlapCheckHeight = overlapCheckNode[0][offsetAttribute];
                const itemPadding = parseInt(
                  domElement.style(padding).replace('px', ''),
                  0
                );

                if (itemPadding < overlapCheckHeight) {
                  // offsetComparator
                  // find out if there's enough place to get rid of overlap
                  // by adjusted the items width
                  const checkWidth = overlapCheckOffset - leftOffset;
                  const currentWidth = parseInt(
                    domElement.style(widthAttribute).replace('px', ''),
                    0
                  );
                  const reducedWidth = currentWidth - checkWidth;

                  if (reducedWidth > offsetComparator) {
                    availableWidth = Math.min(availableWidth, reducedWidth);
                    domElement.style(widthAttribute, availableWidth + 'px');
                  } else {
                    domElement.style(padding, overlapCheckHeight + 'px');
                    updated = true;
                  }
                }
              }
            });
          }
        }
      });
    });

    return updated;
  };

  let optimizerRuns = 0;
  let updated = false;

  do {
    updated = runOptimizer(optimizerRuns);
    optimizerRuns++;
  } while (optimizerRuns < 10 && updated);
};