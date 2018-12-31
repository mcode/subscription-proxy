const rewire = require('rewire');
mapping = rewire('./mapper'); // Bring your module in with rewire

describe('Mapping Tests', () => {

  test('should be able to tell truthy things from falsy things', () => {
    let isTrue = mapping.__get__('isTrue');
    expect(isTrue()).toBeFalsy();
    expect(isTrue(null)).toBeFalsy();
    expect(isTrue([null])).toBeFalsy();
    expect(isTrue({})).toBeFalsy();
    expect(isTrue("false")).toBeFalsy();
    expect(isTrue(["false",null,[],{}])).toBeFalsy();

    expect(isTrue(true)).toBeTruthy();
    expect(isTrue([1])).toBeTruthy();
    expect(isTrue({hey: ""})).toBeTruthy();
    expect(isTrue("true")).toBeTruthy();
    expect(isTrue("string")).toBeTruthy();

  });

	test('should be able to create a filter based off of a string', () => {
    let buildFilter = mapping.__get__('buildFilter');
    let filter = buildFilter("Patient.name");
    expect(filter).toBeTruthy();
    let resource1 = {resourceType: "Patient", name:{given: "James"}};
    let resource2 = {resourceType: "Patient"};
    expect(filter(resource1)).toBeTruthy();
    expect(filter(resource2)).toBeFalsy();
	});

  test('should be able to create a filter based off of a function', () => {
    let buildFilter = mapping.__get__('buildFilter');
    let func = (arg ) => true
    let filter = buildFilter(func);
    expect(filter).toBe(func);
	});

  test('should be able to create a filter based off of an array of filters', () => {
    let buildFilter = mapping.__get__('buildFilter');
    let filters = ["Patient.name", "Patient"];
    let filter = buildFilter(filters);
    expect(filter).toBeTruthy();
    let resource1 = {resourceType: "Patient", name:{given: "James"}};
    let resource2 = {resourceType: "Patient"};
    expect(filter(resource1)).toBeTruthy();
    expect(filter(resource2)).toBeTruthy();
    expect(filter({})).toBeFalsy();
  });

  test('should be able to create a filterMapper from json', () => {
    let buildFilterMappers = mapping.__get__('buildFilterMappers');
    let filterJson = {filter: "Patient.name",
                      exec: (resource) => {
                        resource.mapped = "Its Mapped";
                        return resource;
                      }
                }
    let filterMapper = buildFilterMappers(filterJson);
    expect(filterMapper).toBeTruthy();
    let resource1 = {resourceType: "Patient", name:{given: "James"}};
    let resource2 = {resourceType: "Patient"};
    expect(filterMapper.filter(resource1)).toBeTruthy();
    expect(filterMapper.filter(resource2)).toBeFalsy();
    let mapped = filterMapper.execute(resource1);
    expect(mapped.mapped).toBe("Its Mapped");

  });

  test('should be able to create a resourceMapper from json', () => {
    let resourceMapping = {
      ignore: "Patient.meta.profile.where($this = 'something')",
      exclude:["Patient.name.where($this.given = 'James')"],
      default: (resource) => {
          resource.meta = {profile:['some:uri:here']}
          return resource;
      },
      mappers: [
        {filter: "Patient.name.where($this.given = 'Bob')",
         exec: (resource) => {
              resource.mapped = "Its Mapped";
              return resource;
          }
        }
      ]
    }

    let ResourceTypeMapper = mapping.__get__('ResourceTypeMapper');
    let rtm = new ResourceTypeMapper(resourceMapping);
    let resource1 = {resourceType: "Patient", name:{given: "James"}};
    let resource2 = {resourceType: "Patient", meta: {profile:['something']}};
    let resource3 = {resourceType: "Patient", name: {given: "Bob"}};
    let resource4 = {resourceType: "Patient", name: {given: "Steve"}};

    expect(rtm.ignore(resource1)).toBeFalsy();
    expect(rtm.exclude(resource1)).toBeTruthy();
    expect(rtm.execute(resource1)).toBe(null);

    expect(rtm.ignore(resource2)).toBeTruthy();
    expect(rtm.exclude(resource2)).toBeFalsy();
    expect(rtm.execute(resource2)).toBe(resource2);

    expect(rtm.ignore(resource3)).toBeFalsy();
    expect(rtm.exclude(resource3)).toBeFalsy();
    let mapped = rtm.execute(resource3);
    expect(mapped).toBeTruthy();
    expect(mapped.mapped).toBe("Its Mapped");
    expect(mapped.meta).toBeFalsy();

    expect(rtm.ignore(resource4)).toBeFalsy();
    expect(rtm.exclude(resource4)).toBeFalsy();
    mapped = rtm.execute(resource4);
    expect(mapped).toBeTruthy();
    expect(mapped.mapped).toBeFalsy();
    expect(mapped.meta.profile).toEqual(['some:uri:here']);

  });

    test('should be able to create a mapping engine from json', () => {
      let config = require('./mapping.test_config.js');
      let engine = new mapping.MappingEngine(config);
    });
});
