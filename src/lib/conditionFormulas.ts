// Condition Formulas - Static data from policy documents
// All wording matches exact policy text

export interface ConditionFormulaStep {
  id: string;
  formulaId: string;
  stepNumber: number;
  description: string;
}

export interface ConditionFormula {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
  steps: ConditionFormulaStep[];
}

// Helper to create step IDs
function step(formulaId: string, num: number, desc: string): ConditionFormulaStep {
  return {
    id: `${formulaId}-${num}`,
    formulaId,
    stepNumber: num,
    description: desc,
  };
}

export const CONDITION_FORMULAS: ConditionFormula[] = [
  {
    id: "power",
    name: "Power",
    code: "PW",
    displayOrder: 1,
    steps: [
      step("power", 1, "Don't disconnect"),
      step("power", 2, "Make a record of all of its lines"),
      step("power", 3, "Write it up and get it to the replacement"),
      step("power", 4, "Do all you can to make the post occupiable"),
    ],
  },
  {
    id: "power-change",
    name: "Power Change",
    code: "PC",
    displayOrder: 2,
    steps: [
      step("power-change", 1, "Don't change anything"),
      step("power-change", 2, "Study actions of predecessor and continue successful ones"),
    ],
  },
  {
    id: "power-change-violation-repair",
    name: "Power Change Violation Repair",
    code: "PV",
    displayOrder: 3,
    steps: [
      step("power-change-violation-repair", 1, "Observe, question and draw up a list of what was previously successful in your area or zone of control"),
      step("power-change-violation-repair", 2, "Observe and draw up a list of all those things that were unsuccessful in your area in the past"),
      step("power-change-violation-repair", 3, "Get the successful actions in"),
      step("power-change-violation-repair", 4, "Throw the unsuccessful actions out"),
      step("power-change-violation-repair", 5, "Sensibly get back to a working operation"),
    ],
  },
  {
    id: "affluence",
    name: "Affluence",
    code: "AF",
    displayOrder: 4,
    steps: [
      step("affluence", 1, "Economize"),
      step("affluence", 2, "Pay every bill"),
      step("affluence", 3, "Invest the remainder in service facilities"),
      step("affluence", 4, "Discover what caused the condition of Affluence and strengthen it"),
    ],
  },
  {
    id: "action-affluence",
    name: "Action Affluence",
    code: "AA",
    displayOrder: 5,
    steps: [
      step("action-affluence", 1, "Economize on needless or dispersed actions that did not contribute to the present condition. Economize financially by knocking off all waste"),
      step("action-affluence", 2, "Make every scrap count and don't engage in any useless actions. Every new action counts so only do and act of the basics that are all out efforts"),
      step("action-affluence", 3, "Consolidate all gains. Any place we have gotten a gain, we keep it. Don't let things slide or go to waste while operating at affluence"),
      step("action-affluence", 4, "Don't buy anything foolish"),
    ],
  },
  {
    id: "normal-operation",
    name: "Normal Operation",
    code: "NO",
    displayOrder: 6,
    steps: [
      step("normal-operation", 1, "Don't change anything"),
      step("normal-operation", 2, "Ethics are very mild"),
      step("normal-operation", 3, "When a statistic betters, find out what bettered it and do more of it"),
      step("normal-operation", 4, "When a statistic worsens, find out why and remedy it"),
    ],
  },
  {
    id: "emergency",
    name: "Emergency",
    code: "EM",
    displayOrder: 7,
    steps: [
      step("emergency", 1, "Promote (produce)"),
      step("emergency", 2, "Change your operating basis"),
      step("emergency", 3, "Economize"),
      step("emergency", 4, "Prepare to deliver"),
      step("emergency", 5, "Stiffen discipline"),
    ],
  },
  {
    id: "danger",
    name: "Danger",
    code: "DG",
    displayOrder: 8,
    steps: [
      step("danger", 1, "Bypass (ignore the junior or juniors normally in charge of the activity and handle it personally)"),
      step("danger", 2, "Handle the situation and any danger in it"),
      step("danger", 3, "Assign the area where it had to be handled a Danger condition"),
      step("danger", 4, "Assign each individual connected with the Danger condition a First Dynamic Danger condition and enforce and ensure that they follow the formula completely"),
      step("danger", 5, "Reorganize the activity so that the situation does not repeat"),
      step("danger", 6, "Recommend any firm policy that will hereafter detect and/or prevent the condition from occurring again"),
    ],
  },
  {
    id: "first-dynamic-danger",
    name: "First Dynamic Danger",
    code: "FD",
    displayOrder: 9,
    steps: [
      step("first-dynamic-danger", 1, "Bypass habits or normal routines"),
      step("first-dynamic-danger", 2, "Handle the situation and any danger in it"),
      step("first-dynamic-danger", 3, "Assign self a Danger condition"),
      step("first-dynamic-danger", 4, "Get in your own personal ethics by finding what you are doing that is out-ethics and use self-discipline to correct it and get honest and straight"),
      step("first-dynamic-danger", 5, "Reorganize your life so that the dangerous situation is not continually happening to you"),
      step("first-dynamic-danger", 6, "Formulate and adopt firm policy that will hereafter detect and prevent the same situation from continuing to occur"),
    ],
  },
  {
    id: "non-existence",
    name: "Non-Existence",
    code: "NE",
    displayOrder: 10,
    steps: [
      step("non-existence", 1, "Find a comm line"),
      step("non-existence", 2, "Make yourself known"),
      step("non-existence", 3, "Discover what is needed or wanted"),
      step("non-existence", 4, "Do, produce and/or present it"),
    ],
  },
  {
    id: "expanded-non-existence",
    name: "Expanded Non-Existence",
    code: "EN",
    displayOrder: 11,
    steps: [
      step("expanded-non-existence", 1, "Find yourself on every comm line you will need in order to give and obtain information relating to your post duties and actions"),
      step("expanded-non-existence", 2, "Make yourself known, along with your post title and duties, to these terminals and lines by and with the exchange of information and the giving of data"),
      step("expanded-non-existence", 3, "Find out from your seniors and fellow staff members and any public your duties may require you to contact, what is needed and wanted from you"),
      step("expanded-non-existence", 4, "Do, produce and present what each needs and wants that is also on the purposes of your post"),
      step("expanded-non-existence", 5, "Maintain your comm lines that you have and expand them to obtain other information you now find you need on a routine basis"),
      step("expanded-non-existence", 6, "Maintain your origination lines to let others know what you are doing exactly so they will need what you feed them"),
      step("expanded-non-existence", 7, "Streamline what you are doing, producing and presenting so that it is more closely what is really needed and wanted"),
      step("expanded-non-existence", 8, "Without restraining production, given and received data, your products, do, produce and present a greatly improved product routinely on your own volition"),
    ],
  },
  {
    id: "liability",
    name: "Liability",
    code: "LB",
    displayOrder: 12,
    steps: [
      step("liability", 1, "Decide who are one's friends"),
      step("liability", 2, "Deliver an effective blow to the enemies of the group one has been pretending to be part of despite personal danger"),
      step("liability", 3, "Make up the damage one has done by personal contribution far beyond the ordinary demands of a group member"),
      step("liability", 4, "Apply for re-entry to the group by asking the permission of each member of it to rejoin and rejoining only by majority permission"),
    ],
  },
  {
    id: "doubt",
    name: "Doubt",
    code: "DB",
    displayOrder: 13,
    steps: [
      step("doubt", 1, "Inform oneself honestly of the actual intentions and activities of that group, project or org brushing aside all bias and rumor"),
      step("doubt", 2, "Examine the statistics of the individual, group, project or org"),
      step("doubt", 3, "Decide on the basis of \"the greatest good for the greatest number of dynamics\" whether or not it should be attacked, harmed or suppressed or helped"),
      step("doubt", 4, "Evaluate oneself or one's own group, project or org as to intentions and objectives"),
      step("doubt", 5, "Evaluate one's own or one's group, project or org's statistics"),
      step("doubt", 6, "Join or remain in or befriend the one which progresses toward the greatest good for the greatest number of dynamics and announce the fact publicly to both sides"),
      step("doubt", 7, "Do everything possible to improve the actions and statistics of the person, group, project or org one has remained in or joined"),
      step("doubt", 8, "Suffer on up through the conditions in the new group if one has changed sides, or the conditions of the group one has remained in if wavering from it has lowered one's status"),
    ],
  },
  {
    id: "enemy",
    name: "Enemy",
    code: "EY",
    displayOrder: 14,
    steps: [
      step("enemy", 1, "Find out who you really are"),
    ],
  },
  {
    id: "treason",
    name: "Treason",
    code: "TR",
    displayOrder: 15,
    steps: [
      step("treason", 1, "Find out that you are"),
    ],
  },
  {
    id: "confusion",
    name: "Confusion",
    code: "CF",
    displayOrder: 16,
    steps: [
      step("confusion", 1, "Find out where you are"),
    ],
  },
  {
    id: "expanded-confusion",
    name: "Expanded Confusion",
    code: "EC",
    displayOrder: 17,
    steps: [
      step("expanded-confusion", 1, "Find out where you are"),
      step("expanded-confusion", 2, "Locational at the area of mass confusion"),
      step("expanded-confusion", 3, "Comparing where one is to other areas where one was"),
      step("expanded-confusion", 4, "Repeat step 2"),
    ],
  },
];

// Helper to get formula by ID
export function getFormulaById(id: string): ConditionFormula | undefined {
  return CONDITION_FORMULAS.find((f) => f.id === id);
}

// Helper to get formula by code
export function getFormulaByCode(code: string): ConditionFormula | undefined {
  return CONDITION_FORMULAS.find((f) => f.code === code);
}

// Helper to get step by ID (e.g., "non-existence-1")
export function getStepById(stepId: string): ConditionFormulaStep | undefined {
  for (const formula of CONDITION_FORMULAS) {
    const step = formula.steps.find((s) => s.id === stepId);
    if (step) return step;
  }
  return undefined;
}

// Helper to get formula code and step number from step ID
export function parseStepId(stepId: string): { code: string; stepNumber: number } | undefined {
  const step = getStepById(stepId);
  if (!step) return undefined;
  const formula = getFormulaById(step.formulaId);
  if (!formula) return undefined;
  return { code: formula.code, stepNumber: step.stepNumber };
}

// Get display label for a step (e.g., "NE-1")
export function getStepLabel(stepId: string): string {
  const parsed = parseStepId(stepId);
  if (!parsed) return "";
  return `${parsed.code}-${parsed.stepNumber}`;
}

// Returns sort key for formula step ordering
// Higher value = earlier in condition sequence (sorts first when sorted descending)
// displayOrder 17 (Expanded Confusion) should sort first
// Within formula, step 1 before step 2
export function getFormulaSortKey(stepId: string): number {
  const step = getStepById(stepId);
  if (!step) return 0;
  const formula = getFormulaById(step.formulaId);
  if (!formula) return 0;
  // Higher displayOrder = lower condition = earlier in progression
  // Subtract stepNumber so step 1 sorts before step 2
  return formula.displayOrder * 100 - step.stepNumber;
}
