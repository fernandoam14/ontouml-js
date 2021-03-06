import { OntoumlElement, Project, Package } from '@libs/ontouml';
import {
  transformProperty,
  transformClass,
  transformAdditionalClassConstraints,
  transformAdditionalDatatypeConstraints,
  transformCharacterizationConstraint,
  transformGeneralization,
  transformGeneralizationSet,
  transformRelation
} from './';
import { Service, ServiceIssue } from '..';

export class Ontouml2Alloy implements Service {
  model: Package;
  alloyCode: string[]; // [mainModule, worldStructureModule, ontologicalPropertiesModule]
  datatypes: [string, string[]][]; // [datatypeName, datatypeProperties]
  enums: string[];
  worldFieldDeclarations: string[];
  worldFieldFacts: string[];
  facts: string[];
  relationPropertiesFacts: string[];
  funs: string[];
  visible: string[];
  aliases: [OntoumlElement, string][]; // [element, alias]

  constructor(input: Project | Package, options?: null) {
    if (input instanceof Project) {
      this.model = input.model;
    } else if (input instanceof Package) {
      this.model = input;
    }
    this.alloyCode = ['', '', ''];
    this.datatypes = [];
    this.enums = [];
    this.worldFieldDeclarations = [];
    this.worldFieldFacts = [];
    this.facts = [];
    this.relationPropertiesFacts = [];
    this.funs = [];
    this.visible = ['exists'];
    this.aliases = [];
  }

  getAlloyCode(): string[] {
    return this.alloyCode;
  }

  addDatatype(datatype: [string, string[]]) {
    this.datatypes.push(datatype);
  }

  addEnum(_enum: string) {
    this.enums.push(_enum);
  }

  addWorldFieldDeclaration(declaration: string) {
    this.worldFieldDeclarations.push(declaration);
  }

  addWorldFieldFact(fact: string) {
    this.worldFieldFacts.push(fact);
  }

  addFact(fact: string) {
    this.facts.push(fact);
  }

  addRelationPropertiesFact(relationPropertiesFact: string) {
    this.relationPropertiesFacts.push(relationPropertiesFact);
  }

  addFun(fun: string) {
    this.funs.push(fun);
  }

  addVisible(term: string) {
    this.visible.push(term);
  }

  transform() {
    this.transformClasses();
    this.transformGeneralizations();
    this.transformGeneralizationSets();
    this.transformProperties();
    this.transformRelations();

    // removes possible duplicate facts and funs
    this.worldFieldFacts = [...new Set(this.worldFieldFacts)];
    this.facts = [...new Set(this.facts)];
    this.relationPropertiesFacts = [...new Set(this.relationPropertiesFacts)];
    this.funs = [...new Set(this.funs)];

    this.writePreamble();
    this.writeDatatypes();
    this.writeEnums();
    this.writeWorldSignature();
    this.writeFacts();
    this.writeFuns();
    this.writeRuns();

    this.writeWorldStructureModule();
    this.writeOntologicalPropertiesModule();
  }

  writePreamble() {
    this.alloyCode[0] +=
      'module main\n\n' +
      'open world_structure[World]\n' +
      'open ontological_properties[World]\n' +
      'open util/relation\n' +
      'open util/sequniv\n' +
      'open util/ternary\n\n' +
      'abstract sig Endurant {}\n\n' +
      'sig Object extends Endurant {}\n\n' +
      'sig Aspect extends Endurant {}\n\n' +
      'sig Datatype {}\n\n';
  }

  writeDatatypes() {
    for (const datatype of this.datatypes) {
      const datatypeName = datatype[0];
      const datatypeProperties = [... new Set(datatype[1])];

      if (datatypeProperties.length) {
        this.alloyCode[0] +=
          'sig ' + datatypeName + ' in Datatype {\n' + 
          '        ' + datatypeProperties.join(',\n        ') + '\n' +
          '}\n\n'
      } else {
        this.alloyCode[0] +=
          'sig ' + datatypeName + ' in Datatype {}\n\n'
      }
    }
  }

  writeEnums() {
    if (this.enums.length) {
      this.alloyCode[0] +=
        this.enums.join('\n\n') +
        '\n\n';
    }
  }

  writeWorldSignature() {
    this.alloyCode[0] +=
      'abstract sig World {\n' +
      '        exists: some Endurant,\n' +
      '        ' + this.worldFieldDeclarations.join(',\n        ') + '\n' +
      '}';
    if(this.worldFieldFacts.length) {
      this.alloyCode[0] +=
        ' {\n' +
        '        '+ this.worldFieldFacts.join('\n        ') + '\n' +
        '}';
    }
    this.alloyCode[0] += '\n\n';
  }

  writeFacts() {
    this.alloyCode[0] +=
      'fact additionalFacts {\n' +
      '        continuous_existence[exists]\n' +
      '        elements_existence[Endurant,exists]\n' +
      '}\n\n';

    if (this.relationPropertiesFacts.length) {
      this.alloyCode[0] += 
        'fact relationProperties {\n' +
        '        '+ this.relationPropertiesFacts.join('\n        ') + '\n' +
        '}\n\n'
    }
    
    if (this.facts.length) {
      this.alloyCode[0] += 
        this.facts.join('\n\n') +
        '\n\n';
    }
  }

  writeFuns() {
    this.alloyCode[0] +=
      'fun visible : World->univ {\n' +
      '        ' + this.visible.join('+') + '\n' +
      '}\n\n';
    
    if (this.funs.length) {
      this.alloyCode[0] +=
        this.funs.join('\n\n') +
        '\n\n';
    }
  }

  writeRuns() {
    this.alloyCode[0] +=
      '-- Suggested run predicates\n' +
      'run singleWorld for 10 but 1 World, 7 Int\n' +
      'run linearWorlds for 10 but 3 World, 7 Int\n' +
      'run multipleWorlds for 10 but 4 World, 7 Int\n' +
      'run singleWorld for 20 but 1 World, 7 Int\n' +
      'run linearWorlds for 20 but 3 World, 7 Int\n' +
      'run multipleWorlds for 20 but 4 World, 7 Int\n';
  }

  writeWorldStructureModule() {
    this.alloyCode[1] +=
      'module world_structure[World]\n\n' +
      'some abstract sig TemporalWorld extends World {\n' +
      '        next: set TemporalWorld -- Immediate next moments\n' +
      '} {\n' +
      '        this not in this.^(@next) -- There are no temporal cicles\n' +
      '        lone ((@next).this) -- A world can be the immediate next momment of at maximum one world\n' +
      '}\n\n' +
      'one sig CurrentWorld extends TemporalWorld {} {\n' +
      '        next in FutureWorld\n' +
      '}\n\n' +
      'sig PastWorld extends TemporalWorld {} {\n' +
      '        next in (PastWorld + CounterfactualWorld + CurrentWorld)\n' +
      '        CurrentWorld in this.^@next -- All past worlds can reach the current moment\n' +
      '}\n\n' +
      'sig FutureWorld extends TemporalWorld {} {\n' +
      '        next in FutureWorld\n' +
      '        this in CurrentWorld.^@next -- All future worlds can be reached by the current moment\n' +
      '}\n\n' +
      'sig CounterfactualWorld extends TemporalWorld {} {\n' +
      '        next in CounterfactualWorld\n' +
      '        this in PastWorld.^@next -- All past worlds can reach the counterfactual moment\n' +
      '}\n\n' +
      '-- Elements cannot die and come to life later\n' +
      'pred continuous_existence [exists: World->univ] {\n' +
      '        all w : World, x: (@next.w).exists | (x not in w.exists) => (x not in (( w. ^next).exists))\n' +
      '}\n\n' +
      '-- All elements must exists in at least one world\n' +
      'pred elements_existence [elements: univ, exists: World->univ] {\n' +
      '        all x: elements | some w: World | x in w.exists\n' +
      '}\n\n' +
      '-- Run predicate for a single World\n' +
      'pred singleWorld {\n' +
      '        #World=1\n' +
      '}\n\n' +
      '-- Run predicate for linear Worlds (Past, Current, Future)\n' +
      'pred linearWorlds {\n' +
      '        #World=3 and #PastWorld=1 and #FutureWorld=1\n' +
      '}\n\n' +
      '-- Run predicate for multiple Worlds (Past, Counterfactual, Current, Future)\n' +
      'pred multipleWorlds {\n' +
      '        #World=4 and #PastWorld=1 and #CounterfactualWorld=1 and #FutureWorld=1\n' +
      '}\n';
  }

  writeOntologicalPropertiesModule() {
    this.alloyCode[2] +=
      'module ontological_properties[World]\n\n' +
      '-- This predicate states that a class is rigid\n' +
      'pred rigidity [Class: univ->univ, Nature: univ, exists: univ->univ] {\n' +
      '        all w1: World, p: univ | p in w1.exists and p in w1.Class implies\n' +
      '            all w2: World | w1!=w2 and p in w2.exists implies p in w2.Class\n' +
      '}\n\n' +
      '-- This predicate states that a class is anti-rigid\n' +
      'pred antirigidity [Class: set univ->univ, Nature: univ, exists: univ->univ] {\n' +
      '        all x: Nature | #World>=2 implies (some disj w1,w2: World |\n' +
      '            x in w1.exists and x in w1.Class and x in w2.exists and x not in w2.Class)\n' +
      '}\n\n' +
      '-- This predicate makes the source relation end immutable\n' +
      'pred immutable_source [Target: World->univ, rel: univ->univ->univ] {\n' +
      '        all w1: World, x: univ | x in w1.Target implies\n' +
      '            all w2: World | x in w2.Target implies (w1.rel).x=(w2.rel).x\n' +
      '}\n\n' +
      '-- This predicate makes the target relation end immutable\n' +
      'pred immutable_target [Source: World->univ, rel: univ->univ->univ] {\n' +
      '        all w1: World, x: univ | x in w1.Source implies\n' +
      '            all w2: World | x in w2.Source implies x.(w1.rel)=x.(w2.rel)\n' +
      '}\n';
  }

  transformClasses() {
    const classes = this.model.getAllClasses();

    for (const _class of classes) {
      transformClass(this, _class);
    }

    transformAdditionalClassConstraints(this);
    transformAdditionalDatatypeConstraints(this);

    return true;
  }

  transformGeneralizations() {
    const generalizations = this.model.getAllGeneralizations();

    for (const gen of generalizations) {
      transformGeneralization(this, gen);
    }
  }

  transformGeneralizationSets() {
    const generalizationSets = this.model.getAllGeneralizationSets();

    for (const genSet of generalizationSets) {
      transformGeneralizationSet(this, genSet);
    }
  }

  transformRelations() {
    const relations = this.model.getAllRelations();

    for (const relation of relations) {
      transformRelation(this, relation);
    }

    transformCharacterizationConstraint(this);
  }

  transformProperties() {
    const properties = this.model.getAllProperties();

    for (const property of properties) {
      transformProperty(this, property);
    }
  }

  run(): { result: any; issues?: ServiceIssue[] } {
    this.transform();

    return {
      result: {
        mainModule: this.getAlloyCode()[0],
        worldStructureModule: this.getAlloyCode()[1],
        ontologicalPropertiesModule: this.getAlloyCode()[2]
      },
        issues: undefined
    };
  }
}
