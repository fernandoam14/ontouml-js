import { ModelManager } from '@libs/model';
import { OntoUML2GUFO } from '@libs/ontuml2gufo';
import { IPackage, IOntoUML2GUFOOptions } from '@types';

export async function transformOntoUML2GUFO(
  model: IPackage,
  options?: Partial<IOntoUML2GUFOOptions>,
): Promise<string> {
  const modelCopy = JSON.parse(JSON.stringify(model));
  const modelManager = new ModelManager(modelCopy);
  const service = new OntoUML2GUFO(modelManager);

  return await service.transformOntoUML2GUFO({
    baseIRI: 'https://example.com',
    format: 'N-Triple',
    ...options,
  });
}

it('should ignore', () => {
  expect(true).toBe(true);
});