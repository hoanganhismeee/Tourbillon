import ScrollFade from "../scrollMotion/ScrollFade";
import PocketWatch from "../components/decorations/PocketWatch";
import WatchStickyLayout from "../components/decorations/WatchStickyLayout";

const STORIES = [
  {
    title: 'The Tourbillon',
    body: 'Invented by Abraham-Louis Breguet in 1801, the tourbillon was conceived to counteract the effects of gravity on a pocket watch\'s balance wheel. Rotating once per minute, the cage housing the escapement and balance wheel cancels out positional errors accumulated over time — a mechanical solution of astonishing elegance.',
  },
  {
    title: 'On Complications',
    body: 'A watch complication is any function beyond the simple display of hours and minutes. Perpetual calendars, minute repeaters, split-seconds chronographs — each represents decades of refinement compressed into a space no larger than a coin. The most complicated watch ever made contains over 2,800 components.',
  },
  {
    title: 'The Art of the Dial',
    body: 'Grand feu enamel dials are fired at 850°C, a process repeated up to eight times to build depth of colour. A single crack during firing means starting over. The resulting surface — glassy, luminous, impossible to replicate by machine — is why collectors speak of a dial as a painting.',
  },
  {
    title: 'Movement Finishing',
    body: 'Côtes de Genève, perlage, anglage, blued screws — the finishing of a movement is invisible under most conditions, seen only when the caseback is opened. It exists purely as an expression of pride: proof that no surface was left unconsidered, that beauty was applied even where no one would look.',
  },
  {
    title: 'Time and Material',
    body: 'Steel, gold, platinum, titanium, ceramic, sapphire crystal cases — each material carries different thermal and acoustic properties that change how a watch feels on the wrist. The weight of a gold case, the coldness of steel against skin on a winter morning, the near-weightlessness of titanium: these are part of the experience a collector buys.',
  },
];

// Stories page — editorial content with a sticky animated pocket watch on the right.
export default function StoriesPage() {
  return (
    <ScrollFade>
      <div className="container mx-auto px-8 py-24 pt-32">

        <WatchStickyLayout
          decoration={
            <>
              <PocketWatch size={260} variant="champagne" />
              <div className="text-center">
                <p className="font-playfair text-lg tourbillon-text-color">Grand Complication</p>
                <p className="text-xs tourbillon-text-color opacity-50 mt-1">
                  Perpetual calendar, moon phase, running seconds.<br />
                  Champagne dial with cream-gold indices.
                </p>
              </div>
            </>
          }
        >
          <div>
            <h1 className="text-5xl font-playfair font-bold mb-4 tourbillon-text-color">Stories</h1>
            <p className="text-lg tourbillon-text-color opacity-80 mb-16">
              Read inspiring stories from our watchmakers and collectors.
            </p>

            <div className="space-y-32 pb-40">
              {STORIES.map((s) => (
                <div key={s.title} className="max-w-2xl border-t border-white/10 pt-12">
                  <h2 className="font-playfair text-3xl tourbillon-text-color mb-6">{s.title}</h2>
                  <p className="text-base tourbillon-text-color opacity-60 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </WatchStickyLayout>

      </div>
    </ScrollFade>
  );
}
