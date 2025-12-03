type Entity = string;
type Relation = [Entity, Entity];
type Parental = Relation[];
type TraverseOptionsFull = {
    debug: boolean;
    rootEntity: Entity;
    relations: {
        parental: Parental;
    };
};
export type TraverseOptions = Partial<TraverseOptionsFull>;
declare function Traverse(this: any, options: TraverseOptionsFull): void;
export default Traverse;
//# sourceMappingURL=Traverse.d.ts.map