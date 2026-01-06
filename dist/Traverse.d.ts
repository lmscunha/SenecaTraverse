type EntityID = string;
type ParentChildRelation = [EntityID, EntityID];
type Parental = ParentChildRelation[];
type TraverseOptionsFull = {
    debug: boolean;
    rootExecute: boolean;
    rootEntity: EntityID;
    relations: {
        parental: Parental;
    };
    customRef: Record<EntityID, string>;
};
export type TraverseOptions = Partial<TraverseOptionsFull>;
declare function Traverse(this: any, options: TraverseOptionsFull): void;
export default Traverse;
//# sourceMappingURL=Traverse.d.ts.map