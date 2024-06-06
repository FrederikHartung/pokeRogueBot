package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.entities.RunPropertyEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import repository.RunPropertyEntityRepository;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RunPropertyServiceTest {

    RunPropertyEntityRepository repository;
    RunPropertyService service;
    RunPropertyEntity runPropertyEntity;

    @BeforeEach
    void setUp() {
        repository = mock(RunPropertyEntityRepository.class);
        RunPropertyService objToSpy = new RunPropertyService(repository);
        service = spy(objToSpy);

        runPropertyEntity = new RunPropertyEntity();
        runPropertyEntity.setRunNumber(42);
        doReturn(Optional.of(runPropertyEntity)).when(repository).findFirstOrderByRunNumberDesc();
    }

    @Test
    void getRunProperty_returns_a_new_property_if_no_entity_is_cached() {
        RunProperty result = service.getRunProperty();
        assertEquals(42, result.getRunNumber());
        verify(repository).findFirstOrderByRunNumberDesc();
    }

    @Test
    void if_an_runProperty_is_present_no_new_entity_is_created() {
        RunProperty result = service.getRunProperty();
        RunProperty result2 = service.getRunProperty();
        assertEquals(42, result.getRunNumber());
        assertEquals(42, result2.getRunNumber());
        verify(repository, times(1)).findFirstOrderByRunNumberDesc();
        assertSame(result, result2);
    }
}